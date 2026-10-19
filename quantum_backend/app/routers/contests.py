from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.schemas import ContestSubmissionRequest
from app.security import require_configured_auth
from app.services.contest_service import contest_status, queue_hardware_fidelity, score_submission, store
from app.services.admin_service import DEFAULT_PLATFORM_SETTINGS, store as admin_store
from app.services.gamification_service import store as gamification_store

router = APIRouter(prefix="/api/contests", tags=["Contests"])


@router.get("")
async def list_contests():
    contests = await store.contests()
    for contest in contests:
        contest["status"] = contest_status(contest)
        contest["problem_count"] = len(await store.problems(contest["id"]))
    return {"success": True, "contests": contests}


@router.get("/{contest_id}")
async def contest_detail(contest_id: str):
    contest = await store.contest(contest_id)
    if not contest: raise HTTPException(404, "Contest not found.")
    contest["status"] = contest_status(contest)
    return {"success": True, "contest": contest, "problems": await store.problems(contest_id)}


@router.get("/{contest_id}/problems/{problem_id}")
async def problem_detail(contest_id: str, problem_id: str):
    problem = await store.problem(contest_id, problem_id)
    if not problem: raise HTTPException(404, "Contest problem not found.")
    return {"success": True, "problem": problem}


@router.get("/me/rating")
async def my_rating(user=Depends(require_configured_auth)):
    return {"success": True, "rating": await store.rating((user or {}).get("id", "local-user"))}


@router.post("/{contest_id}/problems/{problem_id}/submit")
async def submit(contest_id: str, problem_id: str, request: ContestSubmissionRequest, background_tasks: BackgroundTasks, user=Depends(require_configured_auth)):
    contest = await store.contest(contest_id)
    if not contest or contest_status(contest) != "live": raise HTTPException(400, "Submissions are only accepted while a contest is live.")
    problem = await store.problem(contest_id, problem_id, private=True)
    if not problem: raise HTTPException(404, "Contest problem not found.")
    try:
        platform_settings = await admin_store.platform_settings()
    except RuntimeError:
        # An unavailable optional settings record must not make the protected
        # sample contest disappear; its schema default remains safe.
        platform_settings = DEFAULT_PLATFORM_SETTINGS
    previous = await store.submissions(problem["id"], (user or {}).get("id", "local-user"))
    if previous and not platform_settings["allow_contest_resubmissions"]:
        raise HTTPException(400, "This contest problem allows one submission per participant.")
    if len(previous) >= platform_settings["contest_submission_limit"]:
        raise HTTPException(400, "You have reached the submission limit for this contest problem.")
    try:
        submission = await score_submission(problem, (user or {}).get("id", "local-user"), request)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    leaderboard = await store.leaderboard(contest_id)
    rank = next((index + 1 for index, row in enumerate(leaderboard) if row["user_id"] == submission["user_id"]), None)
    qualifies_for_hardware = submission["is_best_for_user"] and submission["correctness_score"] >= problem["pass_threshold"]
    if qualifies_for_hardware:
        background_tasks.add_task(queue_hardware_fidelity, submission, problem)
    reward = None
    # Scoring is server-side, so only a qualifying best solution can reach the
    # reward function. A missing optional gamification migration never invalidates
    # a legitimate contest submission.
    if qualifies_for_hardware and user:
        try:
            reward = await gamification_store.award(user["id"], "contest_solution", f"contest:{contest_id}:problem:{problem_id}")
        except RuntimeError:
            reward = None
    return {"success": True, "submission": submission, "rank": rank, "fidelity_status": "queued" if qualifies_for_hardware else "not_queued", "reward": reward}


@router.post("/{contest_id}/finalize")
async def finalize(contest_id: str, user=Depends(require_configured_auth)):
    contest = await store.contest(contest_id)
    if not contest:
        raise HTTPException(404, "Contest not found.")
    if contest_status(contest) != "ended":
        raise HTTPException(400, "Ratings can be finalized only after the contest ends.")
    if not await store.is_admin((user or {}).get("id")):
        raise HTTPException(403, "Only an administrator can finalize contest ratings.")
    try:
        return {"success": True, "result": await store.finalize_ratings(contest)}
    except ValueError as error:
        raise HTTPException(409, str(error)) from error


@router.get("/{contest_id}/leaderboard")
async def leaderboard(contest_id: str):
    if not await store.contest(contest_id): raise HTTPException(404, "Contest not found.")
    return {"success": True, "leaderboard": await store.leaderboard(contest_id)}

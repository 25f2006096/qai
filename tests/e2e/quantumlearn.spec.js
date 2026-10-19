import { test, expect } from '@playwright/test';
import { getE2EAuth } from './test-env.js';

function buildAuthUser() {
  const auth = getE2EAuth();
  if (!auth) {
    test.skip(true, 'E2E credentials not configured (missing E2E_EMAIL or E2E_PASSWORD).');
  }
  return auth;
}

test.describe('QuantumLearn browser E2E suite', () => {
  test.beforeEach(async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('requestfailed', (request) => {
      if (!/favicon|chrome-extension/i.test(request.url())) {
        consoleErrors.push(`Request failed: ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`);
      }
    });

    page.__testIssues = { pageErrors, consoleErrors };
  });

  test('landing page loads and displays auth CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/QuantumLearn AI/i);
    await expect(page.getByRole('heading', { name: /Master Quantum Computing with Interactive AI/i })).toBeVisible();
    await expect(page.getByText(/Sign in to resume your quantum learning roadmap/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i }).nth(0)).toBeVisible();
  });

  test('unauthenticated users are redirected away from protected sections', async ({ page }) => {
    for (const route of ['/dashboard', '/profile', '/notifications', '/circuit', '/lab']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login|\/$/);
      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    }
  });

  test('auth form supports login and forgot password transitions', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In →/i })).toBeVisible();

    // Click forgot password
    await page.getByRole('button', { name: /Forgot password\?/i }).click();
    await expect(page.getByRole('heading', { name: /Reset Password/i })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send Recovery Link →/i })).toBeVisible();

    // Switch back to login
    await page.getByRole('button', { name: /← Back to Sign In/i }).click();
    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
  });

  test('backend health and capabilities endpoints respond', async ({ request }) => {
    const healthResponse = await request.get('/api/health');
    expect(healthResponse.ok()).toBeTruthy();
    expect((await healthResponse.json()).success).toBe(true);

    const capabilitiesResponse = await request.get('/api/capabilities');
    expect(capabilitiesResponse.ok()).toBeTruthy();
    const capabilities = await capabilitiesResponse.json();
    expect(capabilities).toEqual(expect.objectContaining({
      qiskit: expect.any(Boolean),
      qiskit_aer: expect.any(Boolean),
      pennylane: expect.any(Boolean),
      cirq: expect.any(Boolean),
    }));

    const executionResponse = await request.post('/api/quantum/execute', {
      data: {
        framework: 'qiskit',
        shots: 16,
        code: 'from qiskit import QuantumCircuit\nqc = QuantumCircuit(1)\nqc.h(0)\nqc.measure_all()',
      },
    });
    expect(executionResponse.ok()).toBeTruthy();
    const execution = await executionResponse.json();
    expect(execution.success).toBe(true);
    expect(execution.framework).toBe('qiskit');
    expect(execution.shots).toBe(16);
    expect(execution.measurements).toEqual(expect.any(Object));
  });

  test('authenticated sign-in flow works when E2E credentials exist', async ({ page }) => {
    const auth = buildAuthUser();
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(auth.email);
    await page.getByPlaceholder('••••••••').fill(auth.password);
    await page.getByRole('button', { name: /Sign In →/i }).click();

    await expect(page).toHaveURL(/\/(dashboard|test)/, { timeout: 30_000 });
    await expect(page.getByText(/Welcome Back|Quantum Knowledge Assessment/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('new user onboarding can reach the dashboard flow when credentials exist', async ({ page }) => {
    const auth = buildAuthUser();
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(auth.email);
    await page.getByPlaceholder('••••••••').fill(auth.password);
    await page.getByRole('button', { name: /Sign In →/i }).click();

    await page.waitForURL(/\/test|\/dashboard/, { timeout: 30_000 });
    const currentUrl = page.url();
    if (currentUrl.includes('/test')) {
      const skipButton = page.getByRole('button', { name: /Skip|Continue/i }).first();
      if (await skipButton.isVisible().catch(() => false)) {
        await skipButton.click();
      }
    }

    await expect(page).toHaveURL(/\/dashboard|\/test/, { timeout: 20_000 });
    await expect(page.getByText(/Dashboard|Roadmap|Modules/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('assessment starts, requires an answer, and advances when credentials exist', async ({ page }) => {
    const auth = buildAuthUser();
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(auth.email);
    await page.getByPlaceholder('••••••••').fill(auth.password);
    await page.getByRole('button', { name: /Sign In →/i }).click();
    await page.waitForURL(/\/test|\/dashboard/, { timeout: 30_000 });

    test.skip(!page.url().includes('/test'), 'The configured E2E account has already completed onboarding.');
    await expect(page.getByRole('heading', { name: /Quantum Knowledge Assessment/i })).toBeVisible();
    await page.getByRole('button', { name: /Start Assessment/i }).click();
    await expect(page.getByText(/Question 1 of 33/i)).toBeVisible();
    const nextButton = page.getByRole('button', { name: /Next Question/i });
    await expect(nextButton).toBeDisabled();
    await page.locator('.quiz-option').first().click();
    await nextButton.click();
    await expect(page.getByText(/Question 2 of 33/i)).toBeVisible();
  });

  test('roadmap, module, and lab pages render once authenticated', async ({ page }) => {
    const auth = buildAuthUser();
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(auth.email);
    await page.getByPlaceholder('••••••••').fill(auth.password);
    await page.getByRole('button', { name: /Sign In →/i }).click();

    await page.waitForURL(/\/test|\/dashboard/, { timeout: 30_000 });
    const currentUrl = page.url();
    if (currentUrl.includes('/test')) {
      const skipButton = page.getByRole('button', { name: /Skip|Continue/i }).first();
      if (await skipButton.isVisible().catch(() => false)) {
        await skipButton.click();
      }
    }

    await page.goto('/roadmap');
    await expect(page.getByText(/Roadmap|Learning Path/i).first()).toBeVisible({ timeout: 20_000 });

    await page.goto('/modules');
    await expect(page.getByText(/Modules|Learning Modules/i).first()).toBeVisible({ timeout: 20_000 });

    await page.goto('/lab');
    await expect(page.getByText(/Quantum Lab|Circuit Builder|Simulator/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('AI tutor panel can open for authenticated users when credentials exist', async ({ page }) => {
    const auth = buildAuthUser();
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(auth.email);
    await page.getByPlaceholder('••••••••').fill(auth.password);
    await page.getByRole('button', { name: /Sign In →/i }).click();

    await page.waitForURL(/\/test|\/dashboard/, { timeout: 30_000 });
    const currentUrl = page.url();
    if (currentUrl.includes('/test')) {
      const skipButton = page.getByRole('button', { name: /Skip|Continue/i }).first();
      if (await skipButton.isVisible().catch(() => false)) {
        await skipButton.click();
      }
    }

    const tutorToggle = page.locator('.chat-toggle');
    await expect(tutorToggle).toBeVisible();
    await tutorToggle.click();
    await expect(page.getByText('AI Quantum Tutor')).toBeVisible();
    await expect(page.getByPlaceholder('Ask anything quantum...')).toBeVisible();
  });

  test('module assessment and topic quiz are interactive when credentials exist', async ({ page }) => {
    const auth = buildAuthUser();
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(auth.email);
    await page.getByPlaceholder('••••••••').fill(auth.password);
    await page.getByRole('button', { name: /Sign In →/i }).click();
    await page.waitForURL(/\/test|\/dashboard/, { timeout: 30_000 });

    if (page.url().includes('/test')) {
      await page.getByRole('button', { name: /Skip \(I'm a complete beginner\)/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    }

    await page.goto('/modules/1');
    await expect(page.getByRole('heading', { name: /Module 1:/i })).toBeVisible();
    await page.locator('.tab').filter({ hasText: 'Assessment' }).click();
    await expect(page.getByText(/Question 1 of/i)).toBeVisible();
    await expect(page.getByText('Module Assessment')).toBeVisible();

    await page.locator('.tab').filter({ hasText: 'Topics' }).click();
    await page.locator('.topic-item').first().click();
    await page.locator('.tab').filter({ hasText: 'Quiz' }).click();
    await expect(page.getByRole('button', { name: 'Check Answer' })).toBeVisible();
    await page.locator('.quiz-option').first().click();
    await page.getByRole('button', { name: 'Check Answer' }).click();
    await expect(page.locator('.quiz-option.correct')).toBeVisible();
  });

  test('authenticated session survives a page reload when credentials exist', async ({ page }) => {
    const auth = buildAuthUser();
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(auth.email);
    await page.getByPlaceholder('••••••••').fill(auth.password);
    await page.getByRole('button', { name: /Sign In →/i }).click();
    await page.waitForURL(/\/test|\/dashboard/, { timeout: 30_000 });

    if (page.url().includes('/test')) {
      await page.getByRole('button', { name: /Skip \(I'm a complete beginner\)/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    }

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('link', { name: /Dashboard/i })).toBeVisible();
  });

  test('logout flow ends the session when credentials exist', async ({ page }) => {
    const auth = buildAuthUser();
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(auth.email);
    await page.getByPlaceholder('••••••••').fill(auth.password);
    await page.getByRole('button', { name: /Sign In →/i }).click();

    await page.waitForURL(/\/test|\/dashboard/, { timeout: 30_000 });
    const currentUrl = page.url();
    if (currentUrl.includes('/test')) {
      const skipButton = page.getByRole('button', { name: /Skip|Continue/i }).first();
      if (await skipButton.isVisible().catch(() => false)) {
        await skipButton.click();
      }
    }

    const logoutButton = page.getByRole('button', { name: /Sign Out/i });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login|\/$/);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  AI Quantum Tutor — Client integration with Supabase Edge Function, Direct API Key & offline fallback
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '../lib/supabaseClient.js';
import { explainCircuit } from './quantum.js';

// Client credentials are intentionally unsupported. Live AI calls use the
// Supabase Edge Function, whose GROQ credential remains server-side.
function getActiveApiKey() { return ''; }

// Fallback responses for offline / error scenarios
const FALLBACK_RESPONSES = {
  qubit: "A **qubit** is the basic unit of quantum information. Unlike a classical bit (0 or 1), a qubit can exist in a **superposition** of both states simultaneously: |ψ⟩ = α|0⟩ + β|1⟩, where |α|² + |β|² = 1. When measured, it collapses to either |0⟩ or |1⟩ with probabilities |α|² and |β|² respectively.",
  superposition: "**Superposition** means a qubit can be in a combination of |0⟩ and |1⟩ at the same time. Think of a coin spinning in the air — it's neither heads nor tails until it lands. The Hadamard gate H creates superposition: H|0⟩ = (|0⟩+|1⟩)/√2 = |+⟩",
  entanglement: "**Quantum entanglement** means two or more qubits become correlated such that measuring one instantly determines the state of the other, no matter how far apart. A Bell state (|00⟩+|11⟩)/√2 is a perfect example — measuring the first qubit as |0⟩ means the second is also |0⟩.",
  hadamard: "The **Hadamard gate** H creates superposition:\n- H|0⟩ = (|0⟩+|1⟩)/√2 = |+⟩\n- H|1⟩ = (|0⟩-|1⟩)/√2 = |−⟩\n\nMatrix: H = (1/√2) [[1,1],[1,-1]]\n\nApplying H twice returns to the original state: HH = I",
  measurement: "**Quantum measurement** collapses a qubit from superposition to a definite state. For state α|0⟩ + β|1⟩:\n- Probability of measuring |0⟩ = |α|²\n- Probability of measuring |1⟩ = |β|²\n\nAfter measurement, the state collapses — you cannot 'unmeasure' a qubit.",
  default: "Great question! I'm your AI quantum tutor. Ask me about any quantum computing topic — qubits, gates, circuits, algorithms, Qiskit, QML, or anything from your current module. I'm here to explain, give hints, and help you understand your mistakes.",
};

export function cleanResponseContent(text) {
  if (!text) return '';

  return String(text)
    .replace(/^\uFEFF/, '')
    .replace(/<think\b[^>]*>[\s\S]*?(<\/think>|$)/gi, '')
    .replace(/<analysis\b[^>]*>[\s\S]*?(<\/analysis>|$)/gi, '')
    .replace(/<\/?(?:think|analysis)>/gi, '')
    .replace(/<\|(?:im_start|im_end|assistant|user|system)\|>/gi, '')
    .replace(/^\s*(?:assistant|ai)\s*:\s*/i, '')
    .trim();
}

async function callDirectGroqApi(apiKey, messages) {
  const models = [
    'qwen/qwen3.8-27b',
    'qwen/qwen3.6-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-8b-8192'
  ];
  let lastError = null;

  for (const model of models) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.6,
          max_tokens: 1024
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (rawContent) {
          const cleaned = cleanResponseContent(rawContent);
          if (cleaned) return cleaned;
        }
      } else {
        const errorJson = await response.json().catch(() => ({}));
        lastError = new Error(errorJson?.error?.message || `HTTP ${response.status}`);
        console.warn(`Groq model ${model} returned error:`, lastError.message);
      }
    } catch (e) {
      lastError = e;
      console.warn(`Fetch exception with Groq model ${model}:`, e.message);
    }
  }

  throw lastError || new Error('All Groq model endpoints failed.');
}

/**
 * Generate a rich structured offline AI explanation for a circuit
 */
export function generateOfflineCircuitExplanation(ops, nQubits) {
  if (!ops || ops.length === 0) return null;
  const sorted = [...ops].filter(o => o.gate !== 'M').sort((a, b) => a.col - b.col);
  if (sorted.length === 0) return null;

  const analysis = explainCircuit(ops, nQubits);
  if (!analysis) return null;

  const gateCount = sorted.length;
  const gatesUsed = Array.from(new Set(sorted.map(o => o.gate))).join(', ');

  let summaryText = `This circuit operates on **${nQubits} qubit${nQubits > 1 ? 's' : ''}** with **${gateCount} gate operation${gateCount > 1 ? 's' : ''}** (\`${gatesUsed}\`).`;

  const hasH = sorted.some(o => o.gate === 'H');
  const hasCNOT = sorted.some(o => o.gate === 'CNOT');
  const hasX = sorted.some(o => o.gate === 'X');
  const hasRot = sorted.some(o => ['Rx', 'Ry', 'Rz'].includes(o.gate));

  if (hasH && hasCNOT) {
    summaryText += ` It creates **quantum entanglement** between qubits, generating a highly correlated multi-qubit superposition state (such as a **Bell state**).`;
  } else if (hasH) {
    summaryText += ` It uses the **Hadamard gate** to put qubit(s) into **superposition**, placing them in a linear combination of |0⟩ and |1⟩.`;
  } else if (hasCNOT) {
    summaryText += ` It utilizes conditional quantum logic (**CNOT**) to perform controlled bit flips.`;
  } else if (hasRot) {
    summaryText += ` It uses continuous rotation gates (**Rx/Ry/Rz**) to rotate qubit state vectors on the **Bloch sphere**.`;
  }

  let stepsMarkdown = '';
  analysis.transformations.forEach((t, i) => {
    if (i === 0) {
      stepsMarkdown += `1. **Initial State**: |ψ₀⟩ = \`${t.state}\`\n`;
    } else {
      stepsMarkdown += `${i + 1}. **Apply ${t.step}**: State transforms to |ψ${i}⟩ = \`${t.state}\`\n`;
    }
  });

  let conceptsMarkdown = '';
  analysis.concepts.forEach(c => {
    conceptsMarkdown += `- ${c}\n`;
  });

  return `### 🎯 Executive Summary
${summaryText}

### ⚡ Step-by-Step Quantum Transformations
${stepsMarkdown}

### 🔬 Key Quantum Phenomena
${conceptsMarkdown}

### 💡 Applications & Technical Insights
- **Circuit Depth**: ${Math.max(0, ...ops.map(o => o.col)) + 1}
- **Active Gates**: \`${gatesUsed}\`
- **Tip**: Switch to the **⟨ψ| State** tab for exact Dirac notation or **Matrices** for explicit unitary matrices.`;
}

/**
 * Get a fallback response using keyword matching (used when server/API is offline)
 */
function getFallbackResponse(message, currentModule, currentTopic) {
  const msg = (message || '').toLowerCase();
  let response = FALLBACK_RESPONSES.default;

  if (msg.includes('qubit')) response = FALLBACK_RESPONSES.qubit;
  else if (msg.includes('superposition')) response = FALLBACK_RESPONSES.superposition;
  else if (msg.includes('entangl')) response = FALLBACK_RESPONSES.entanglement;
  else if (msg.includes('hadamard') || msg.includes(' h gate')) response = FALLBACK_RESPONSES.hadamard;
  else if (msg.includes('measur')) response = FALLBACK_RESPONSES.measurement;
  else if (msg.includes('hint')) {
    response = currentTopic
      ? `💡 **Hint for ${currentTopic}:** Think about what operation creates superposition first, then how to use that as a control. Work step by step through the circuit from left to right.`
      : `💡 **Hint:** Break the problem into small steps. What is the goal state? What gates achieve each transformation? Check prerequisites!`;
  }

  if (currentModule && response === FALLBACK_RESPONSES.default) {
    response = `I see you're working on Module ${currentModule}. ${response}\n\nFor this module, focus on: understanding the core concept, working through the examples, and trying the interactive demos. What specific aspect would you like help with?`;
  }

  return response;
}

/**
 * Send a chat message via Supabase Edge Function (using Supabase secrets), Direct API Key, or offline fallback
 */
export async function getGroqResponse(userMessage, chatHistory = [], currentModule = null, currentTopic = null) {
  // 1. Try Supabase Edge Function (uses GROQ_API_KEY secret configured in Supabase Dashboard)
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('ai-tutor', {
        body: {
          mode: 'chat',
          userMessage,
          chatHistory,
          currentModule,
          currentTopic
        }
      });

      if (!error && data && data.text) {
        const cleaned = cleanResponseContent(data.text);
        if (cleaned) return cleaned;
      }
    } catch (err) {
      console.warn('Supabase Edge Function invocation failed, falling back to direct API key:', err);
    }
  }

  // 2. Try Direct Groq API Key if configured in client (.env or UI modal)
  const apiKey = getActiveApiKey();
  if (apiKey) {
    try {
      const formattedHistory = chatHistory
        .filter(m => m && m.text && m.text.trim())
        .slice(-6)
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text.trim()
        }));

      const systemPrompt = `You are QuantumLearn AI, an expert, encouraging, interactive quantum computing tutor. Topic context: ${currentTopic || 'Quantum Computing'}. Use Dirac notation like |0⟩, |1⟩, |+⟩ where appropriate. Format answers cleanly in Markdown with concise code blocks if requested. Give progressive hints before a full answer. Never claim a mission is complete, award XP, or invent simulator results; those are determined only by the application after trusted validation.`;
      
      const messages = [
        { role: 'system', content: systemPrompt },
        ...formattedHistory,
        { role: 'user', content: userMessage.trim() }
      ];

      const directText = await callDirectGroqApi(apiKey, messages);
      if (directText) return directText;
    } catch (err) {
      console.warn('Direct Groq API Key call failed:', err.message);
    }
  }

  // 3. Smart offline fallback response
  return getFallbackResponse(userMessage, currentModule, currentTopic);
}

// Sync version for backward compatibility
export function getAIResponse(message, currentModule = null, currentTopic = null) {
  return getFallbackResponse(message, currentModule, currentTopic);
}

/**
 * Generate a real-time AI explanation of a quantum circuit
 */
export async function explainCircuitWithGroq(ops, nQubits) {
  if (!ops || ops.length === 0) return null;

  // 1. Try Supabase Edge Function (uses GROQ_API_KEY secret configured in Supabase)
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('ai-tutor', {
        body: {
          mode: 'explain_circuit',
          ops,
          nQubits
        }
      });

      if (!error && data && data.text) {
        const cleaned = cleanResponseContent(data.text);
        if (cleaned) return cleaned;
      }
    } catch (err) {
      console.warn('Circuit explanation Edge Function failed, trying direct API key:', err);
    }
  }

  // 2. Try Direct Groq API Key
  const apiKey = getActiveApiKey();
  if (apiKey) {
    try {
      const offlineSummary = generateOfflineCircuitExplanation(ops, nQubits);
      const systemPrompt = `You are QuantumLearn AI. Explain the given quantum circuit in depth with clear section headers (### Executive Summary, ### Quantum Transformations, ### Applications). Include exact state evolution in Dirac notation.`;
      const userPrompt = `Circuit: ${nQubits} qubits. Gate sequence: ${JSON.stringify(ops)}.\nBase Analysis:\n${offlineSummary}`;
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      const directText = await callDirectGroqApi(apiKey, messages);
      if (directText) return directText;
    } catch (err) {
      console.warn('Direct API Key explanation call failed:', err.message);
    }
  }

  // 3. Fallback to rich offline explanation generator
  return generateOfflineCircuitExplanation(ops, nQubits);
}

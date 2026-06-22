async function probeModel(model) {
  const t0 = performance.now();

  const body = {
    model,
    messages: [{ role: 'user', content: 'ping' }],
    temperature: 0.3,
    max_tokens: 16,
    stream: true,
    reasoning_effort: 'none',
  };

  try {
    const res = await fetch(process.env.LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

    const tConnect = performance.now() - t0;
    console.log(`[${model}] t_connect_ms:`, Math.round(tConnect), 'status:', res.status);

    if (!res.ok) {
      console.log(`[${model}] body:`, (await res.text()).slice(0, 300));
      return;
    }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let firstTokenLogged = false;

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buf += dec.decode(value, { stream: true });
      if (!firstTokenLogged && buf.includes('"content"')) {
        firstTokenLogged = true;
        console.log(`[${model}] t_first_token_ms:`, Math.round(performance.now() - t0));
      }
    }
    if (done) {
      break;
    }
  }

    console.log(`[${model}] t_total_ms:`, Math.round(performance.now() - t0));
  } catch (error) {
    console.error(
      `[${model}] ERR`,
      error instanceof Error ? error.message : error,
      Math.round(performance.now() - t0),
    );
  }
}

const models = [
  process.env.LLM_MODEL ?? 'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

for (const model of models) {
  await probeModel(model);
}

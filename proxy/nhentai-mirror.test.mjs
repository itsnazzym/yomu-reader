import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const proxyDirectory = dirname(fileURLToPath(import.meta.url));
const proxyEntry = join(proxyDirectory, "nhentai-mirror.mjs");

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function request(port, { method = "GET", path = "/healthz", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, method, path, headers },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.once("error", reject);
    req.end(body);
  });
}

async function waitForHealth(port, child, output) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Proxy exited early (${child.exitCode}):\n${output()}`);
    }
    try {
      const response = await request(port);
      if (response.status === 200) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Proxy health check timed out:\n${output()}`);
}

test("local binding, CORS, body limit, and sensitive rate limit", { timeout: 15_000 }, async (t) => {
  const port = await reservePort();
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [proxyEntry], {
    cwd: dirname(proxyDirectory),
    env: {
      ...process.env,
      PROXY_PORT: String(port),
      PROXY_HOST: "",
      PROXY_CORS_ORIGINS: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });

  const nativeHealth = await waitForHealth(port, child, () => stdout + stderr);
  assert.equal(nativeHealth.headers["access-control-allow-origin"], undefined);
  assert.match(stdout, new RegExp(`http://127\\.0\\.0\\.1:${port}`));

  const allowed = await request(port, {
    headers: { Origin: "http://localhost:1420" },
  });
  assert.equal(allowed.status, 200);
  assert.equal(
    allowed.headers["access-control-allow-origin"],
    "http://localhost:1420"
  );
  assert.match(allowed.headers.vary || "", /Origin/);

  const denied = await request(port, {
    headers: { Origin: "https://attacker.example" },
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers["access-control-allow-origin"], undefined);

  const preflight = await request(port, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:1420",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers["access-control-allow-methods"] || "", /POST/);

  const oversized = await request(port, {
    method: "POST",
    path: "/api/auth/login",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(1_000_000) }),
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(JSON.parse(oversized.body), {
    error: "Corps de requête trop grand",
    captchaRequired: false,
  });

  for (let attempt = 0; attempt < 4; attempt++) {
    const invalidLogin = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(invalidLogin.status, 400);
  }
  const limited = await request(port, {
    method: "POST",
    path: "/api/auth/login",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers["retry-after"] || 0) > 0);

  const finalHealth = await request(port);
  assert.equal(finalHealth.status, 200);
});

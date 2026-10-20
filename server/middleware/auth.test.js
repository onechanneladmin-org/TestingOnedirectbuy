const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequireAuth } = require("./auth");

function run(mw, req) {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;
  mw(
    { method: "GET", baseUrl: "/api", path: "/flows", headers: {}, query: {}, ...req },
    res,
    () => {
      nextCalled = true;
    },
  );
  return { res, nextCalled };
}

const withToken = createRequireAuth(() => "s3cret");
const noToken = createRequireAuth(() => "");

test("unset API_TOKEN fails closed with 503", () => {
  const { res, nextCalled } = run(noToken, {});
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
});

test("unset API_TOKEN still refuses a request that sends a token", () => {
  const { res, nextCalled } = run(noToken, {
    headers: { authorization: "Bearer anything" },
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
});

test("GET /api/health is public even without API_TOKEN", () => {
  const { nextCalled } = run(noToken, { path: "/health" });
  assert.equal(nextCalled, true);
});

test("POST /api/health is not public", () => {
  const { res, nextCalled } = run(withToken, { method: "POST", path: "/health" });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("missing token is 401", () => {
  const { res, nextCalled } = run(withToken, {});
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("wrong bearer token is 401", () => {
  const { res, nextCalled } = run(withToken, {
    headers: { authorization: "Bearer nope" },
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("correct bearer token passes", () => {
  const { nextCalled } = run(withToken, {
    headers: { authorization: "Bearer s3cret" },
  });
  assert.equal(nextCalled, true);
});

test("correct x-api-token header passes", () => {
  const { nextCalled } = run(withToken, { headers: { "x-api-token": "s3cret" } });
  assert.equal(nextCalled, true);
});

test("?token= query string is no longer accepted", () => {
  const { res, nextCalled } = run(withToken, { query: { token: "s3cret" } });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

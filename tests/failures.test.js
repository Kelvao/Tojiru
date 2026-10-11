const test = require("node:test");
const assert = require("node:assert");
const { DOMAIN_SCRIPTS, loadScripts } = require("./load");

const { domain: D, usecases: U } = loadScripts([...DOMAIN_SCRIPTS, "src/application/failures.js"]);

test("toAppError classifies browser failures and keeps the original as cause", () => {
  const named = (name, message = "") => Object.assign(new Error(message), { name });
  const code = (error) => U.toAppError(error).code;
  assert.equal(code(named("QuotaExceededError")), D.ErrorCode.STORAGE_FULL);
  assert.equal(code(named("NotReadableError")), D.ErrorCode.FILE_UNREADABLE);
  assert.equal(code(named("NotFoundError")), D.ErrorCode.FILE_UNREADABLE);
  assert.equal(code(named("RangeError", "Array buffer allocation failed")), D.ErrorCode.OUT_OF_MEMORY);
  assert.equal(code(named("RangeError", "Invalid time value")), D.ErrorCode.UNEXPECTED);
  assert.equal(code(new Error("boom")), D.ErrorCode.UNEXPECTED);
  assert.equal(code("plain string"), D.ErrorCode.UNEXPECTED);
  const original = new Error("boom");
  assert.equal(U.toAppError(original).cause, original);
  assert.deepEqual({ ...U.toAppError(original).params }, { detail: "boom" });
});

test("toAppError keeps application errors untouched", () => {
  const metadata = new D.MetadataError([{ field: "series", rule: "required" }]);
  assert.equal(U.toAppError(metadata), metadata);
  const image = new D.ImageReadError("a.png", { cause: new Error("decode") });
  assert.equal(U.toAppError(image), image);
});

test("withAppErrors converts synchronous and asynchronous failures", async () => {
  const sync = U.withAppErrors(() => {
    throw new Error("sync");
  });
  const async = U.withAppErrors(async () => {
    throw new Error("async");
  });
  assert.throws(sync, (error) => error instanceof D.AppError && error.params.detail === "sync");
  await assert.rejects(async(), (error) => error instanceof D.AppError && error.params.detail === "async");
});

test("withAppErrors passes results through", async () => {
  assert.equal(U.withAppErrors((value) => value * 2)(21), 42);
  assert.equal(await U.withAppErrors(async (value) => value * 2)(21), 42);
});

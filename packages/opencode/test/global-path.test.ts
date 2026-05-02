import { afterEach, describe, expect, test } from "bun:test"
import os from "os"
import { Global } from "../src/global"

const home = process.env.OPENCODE_HOME
const test_home = process.env.OPENCODE_TEST_HOME

afterEach(() => {
  if (home === undefined) delete process.env.OPENCODE_HOME
  else process.env.OPENCODE_HOME = home

  if (test_home === undefined) delete process.env.OPENCODE_TEST_HOME
  else process.env.OPENCODE_TEST_HOME = test_home
})

describe("Global.Path.home", () => {
  test("prefers OPENCODE_HOME over OPENCODE_TEST_HOME", () => {
    process.env.OPENCODE_HOME = "/runtime-home"
    process.env.OPENCODE_TEST_HOME = "/test-home"

    expect(Global.Path.home).toBe("/runtime-home")
  })

  test("falls back to OPENCODE_TEST_HOME for tests", () => {
    delete process.env.OPENCODE_HOME
    process.env.OPENCODE_TEST_HOME = "/test-home"

    expect(Global.Path.home).toBe("/test-home")
  })

  test("falls back to the system home", () => {
    delete process.env.OPENCODE_HOME
    delete process.env.OPENCODE_TEST_HOME

    expect(Global.Path.home).toBe(os.homedir())
  })
})
#!/usr/bin/env bun
// Raises the default timeout of the pages the demo checks open. Loaded with `bun --preload` by
// scripts/check-demo.mjs, which sets CHECK_TIMEOUT in milliseconds; without it this does nothing.
//
// The checks were written on an idle machine, where Playwright's 30-second default is plenty. On a
// busy one a dev server can take longer than that to serve a page, and a check fails on the machine
// rather than on the app. Raising the default here keeps the check files as they are.
import { chromium } from 'playwright-core'

const timeout = Number(process.env.CHECK_TIMEOUT ?? 0)
if (timeout > 0) {
  /** Applies the run's timeout to a page or a context. @param {{ setDefaultTimeout: Function, setDefaultNavigationTimeout: Function }} target */
  const widen = target => {
    target.setDefaultTimeout(timeout)
    target.setDefaultNavigationTimeout(timeout)
  }
  const launch = chromium.launch.bind(chromium)
  // @ts-expect-error -- the launcher is an object property, replaced for this run only.
  chromium.launch = async (...args) => {
    const browser = await launch(...args)
    const newContext = browser.newContext.bind(browser)
    const newPage = browser.newPage.bind(browser)
    // @ts-expect-error -- see above.
    browser.newContext = async (...contextArgs) => { const context = await newContext(...contextArgs); widen(context); return context }
    // @ts-expect-error -- see above.
    browser.newPage = async (...pageArgs) => { const page = await newPage(...pageArgs); widen(page); return page }
    return browser
  }
}

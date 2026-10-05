# QA scripts (not part of the app)
Playwright (Python) checks used to validate Sutra. Prereqs: `pip install playwright && playwright install chromium`, `npm i --prefix /tmp axe-core`.
Start the app (`npm run build && npm run start -- -p 3300`), then:

    python3 qa/e2e.py              # 4 scenarios + mobile + reduced motion, full flow, console errors, overflow
    python3 qa/responsive.py 390   # also 768 820 1024 1280 1440: overflow + dock bounds + screenshots to /tmp/shots2
    python3 qa/a11y.py             # axe at 8 states, keyboard-only walkthrough, structure, reduced motion
    python3 qa/focus.py            # focus moves to the new section heading after each step

Scripts assume http://localhost:3300 and write screenshots to /tmp/shots*. The only expected console message is the simulated 503 in `?scenario=error`.

# 国家发展实验室

Buildless, private-first historical political-economy learning tool. Serve `dist/` over HTTP (`python -m http.server 4173 --directory dist`).

Nine rounds: Korea 1960–1990, Singapore 1965–1995, Argentina 1960–1990. Flow: observe → policy choices → sealed prediction → historical reveal → comparison → causal reflection.

Quantitative data are WDI snapshots: GDP per capita in constant 2015 USD, population, urbanization. Historical summaries are editorial and bibliography access limitations are disclosed. There is no estimated policy counterfactual. Progress and notes are stored only in the current browser's localStorage.

`dist/data.js`: editorial cases and qualitative policy mechanisms.
`dist/indicators.json`: observed quantitative series and geographic outlines.
`dist/app.js`: six-step state machine and accessible rendering.
`dist/style.css`: desktop/mobile layouts.

Source data files for all outcomes are delivered to the browser: concealment is pedagogical, not a security boundary. A read-only WebMCP brief is registered when the browser supports it and returns only current-period conditions.

Validation: all 9 rounds completed in Chromium; prediction gating, sealed choices, 5 causal categories, 11 yearly observations per round, refresh persistence, nine notebook entries, country switching, mobile 390 px, and 200% root text sizing checked. No uncaught browser errors. The environment did not expose a native WebMCP-enabled browser; that optional registration remains unvalidated in a native WebMCP context.

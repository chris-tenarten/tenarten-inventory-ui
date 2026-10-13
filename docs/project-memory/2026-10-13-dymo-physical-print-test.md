# Anthony — DYMO 550 / 30256 physical print test

Local review candidate only. Driver compatibility, physical output and settings persistence are **not yet verified**. No Production release is authorized. The label's application/PDF/browser checks are already complete; this worksheet tests the actual printer and workstation.

## Workstation preparation — done once by the person setting up the test

1. Use Anthony's computer connected to the **DYMO LabelWriter 550**. Ensure supported **DYMO Connect for Desktop** software/driver is installed, then connect the printer by USB. DYMO instructs installing its software before connecting the printer. Use authentic compatible DYMO 30256 stock and ensure the printer recognizes the loaded roll. A photographed item number alone does not establish that this specific roll is recognized by the 550. See the [DYMO 550 user guide](https://download.dymo.com/dymo/user-guides/LabelWriter/LW550Series/LW550_UserGuide.en.pdf) and [official downloads](https://www.dymo.com/support?cfid=user-guide).
2. Copy and unpack `tenops-dymo-print-test-packet.zip` onto Anthony's computer. The packet is currently prepared on Chris's machine; it has not been transferred or installed on Anthony's.
3. Have Node.js available (launcher checked here with Node 24.18.0). Open a terminal in the unpacked folder and run:

   ```sh
   node scripts/serve-color-plate-label-print-test.mjs
   ```

   No npm install, database, Docker, migration or build is required. This launches a loopback-only read-only test data source, not a print bridge. Keep its terminal open during the test; Ctrl+C stops it. If port 3000 is busy, ask the application owner to identify the process; the launcher never replaces it automatically.
4. In Chrome on **that same computer**, open the URL printed by the launcher: `http://localhost:3000/samples?open=5698d0ba-2dea-4a60-b583-cd97cbf876e2`. The fixed test account is read-only and the displayed Sample is a local fixture. Saving, issuance, hosted operations and permission changes are disabled.

## Operator steps — no PDF download or DYMO import

1. Open the Sample and click **PRINT COLOR PLATE LABEL**.
2. Review the populated information. For this historical comparison, enter **Custom Blended White Marble** in **Chips**. To match the reference, review/enter plate **T26-256-A**, chip sizes **NTMA #0, #1, #2 & #3–5**, and finish **200g. w/ TerraGlaze WB Acrylic Sealer**. These are temporary label edits; do not save or modify the Sample.
3. Click **Print**. A ready label tab opens and Chrome immediately requests its print dialog. If Chrome blocks the tab, allow pop-ups for this localhost test page and retry; no global browser-security change is needed.
4. In Chrome's print dialog, select **DYMO LabelWriter 550** as the destination if it is not already selected. For this first physical test, the setup person checks the settings below. Once retention has been demonstrated, the intended everyday operator step is simply confirm the destination and click **Print**.
5. Click Chrome's final **Print** button. Inspect the physical label, then close the temporary label tab to return to the Sample. No Download PDF, Save as PDF, DYMO import or manual label recreation is involved. Chrome's ordinary print flow requires choosing a destination/settings and confirming Print; see [Google's Chrome printing help](https://support.google.com/chrome/answer/1069693?co=GENIE.Platform%3DDesktop&hl=en).

The dialog is intentional: this candidate does not silently print. If selecting the printer or correcting settings is required every time, record that result as a failure of printing simplicity, not an accepted operator burden.

## Settings to inspect on the first physical test

These are desired initial settings, **not verified requirements of Anthony's installed driver**. Change only a setting that is wrong or required by that actual driver; record what was manual. The application requests the label's size/orientation, but cannot force Chrome's destination or driver preferences.

| Setting | Correct first-test state | What is known about persistence |
| --- | --- | --- |
| Destination | Actual DYMO LabelWriter 550 | Not tested on Anthony's machine; select manually if needed |
| Paper / label stock | Matching **30256**, 4 × 2 5/16 inches (roughly 102 × 59 mm), not Letter/A4; record the actual driver option name | Not tested; driver/Chrome may retain defaults, but no guarantee is made |
| Orientation | Wide label / landscape, matching the on-screen label; use the driver's orientation control only if necessary/available | Not tested; record whether an explicit change was required |
| Scale | **100% / actual size**, without fit-to-page enlargement or reduction | Not tested |
| Margins | **None** in Chrome if offered; the label already includes its own content clearance | Not tested |
| Headers and footers | **Off**; no date, URL or page number outside the label | Not tested on DYMO; they were enabled with Chris's unrelated non-DYMO destination |
| Pages per sheet | **1** | Not tested |
| Copies | **1** for the first test | Not tested |

If the 30256 stock is not offered or the preview cannot be made correctly sized/oriented through the supported driver, stop and record the available options. Do not make the operator create a custom paper size, import a PDF, install a custom bridge or work through experimental settings. Exact Windows/macOS driver menu names cannot be specified until Anthony's OS and installed driver are known.

## Physical result and retention record

Record computer OS/version, Chrome version, DYMO software/driver version, actual destination name and actual stock-option name. Include a front photograph of the printed label with a ruler and a screenshot of the final print settings if useful.

| Check | Result to fill in |
| --- | --- |
| Exactly one label feeds and prints | Pending |
| Wide orientation; physical size matches 30256 | Pending |
| Plate number, project/date and material text readable | Pending |
| No clipped text, unwanted blank labels or scaling | Pending |
| No browser headers/footer/URL/date | Pending |
| Text and border clear of the physical label edges | Pending |
| Which settings needed a manual change on first print? | Pending |
| Cancel/reopen Print: do all settings remain correct? | Pending |
| Open another label/return to this Sample: retained? | Pending |
| Close/restart Chrome in the same profile: retained? | Pending |
| Print again after restart: physical output still correct? | Pending |
| Restart workstation if practical: retained? | Pending / not tested |

No setting can currently be reported as persistent. Inspect retention before changing a setting again; otherwise the test cannot distinguish remembered settings from manual corrections. Repeated reconfiguration is a Product acceptance failure. Keep PDF-generation verification, native browser-dialog verification, DYMO-driver verification and physical-print verification as four separate results.

If Chrome cannot retain the required DYMO stock/settings reliably, the researched supported alternative is **DYMO Connect Framework (JavaScript SDK)** with installed **DYMO Connect Software and its running local service**, plus a validated DYMO label template. The [official SDK repository](https://github.com/dymosoftware/dymo-connect-framework) documents that software dependency. Product approval is required before integrating it. No SDK, print bridge or new background printing service is part of this candidate.

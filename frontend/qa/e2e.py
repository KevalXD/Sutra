import sys, json
from playwright.sync_api import sync_playwright
B="http://localhost:3300"
res={}
def run(p, scenario, vw, vh, tag, reduced=False):
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":vw,"height":vh}, reduced_motion="reduce" if reduced else "no-preference"); pg=ctx.new_page()
    errs=[]; pg.on("console", lambda m: errs.append(m.text) if m.type in("error","warning") else None); pg.on("pageerror", lambda e: errs.append("PAGEERROR "+str(e)))
    out={}
    pg.goto(f"{B}/?scenario={scenario}"); 
    if scenario=="error":
        pg.get_by_text("load this journey").wait_for(timeout=8000); out["error_shown"]=True
        pg.screenshot(path=f"/tmp/shots/{tag}_error.png")
        pg.get_by_role("button",name="Retry").click()
    pg.get_by_role("button",name="Simulate disruption").first.wait_for(timeout=8000); out["trip"]=True
    pg.wait_for_timeout(800); pg.screenshot(path=f"/tmp/shots/{tag}_1trip.png")
    pg.get_by_role("button",name="Simulate disruption").first.click()
    pg.get_by_role("button",name="Analyze impact").first.wait_for(timeout=8000); out["disruption"]=True
    pg.wait_for_timeout(1000); pg.screenshot(path=f"/tmp/shots/{tag}_2disruption.png")
    pg.get_by_role("button",name="Analyze impact").first.click()
    pg.get_by_role("button",name="Find recovery").first.wait_for(timeout=8000); out["impact"]=True
    pg.wait_for_timeout(2200); pg.screenshot(path=f"/tmp/shots/{tag}_3impact.png")
    pg.get_by_role("button",name="Find recovery").first.click()
    pg.wait_for_timeout(900); out["analysis_visible"]=pg.locator("#analysis").count()>0
    pg.screenshot(path=f"/tmp/shots/{tag}_4analysis.png")
    pg.wait_for_selector("#result", timeout=15000); pg.wait_for_timeout(1800)
    out["result_heading"]=pg.locator("#result h2").inner_text()
    out["has_alert"]=pg.locator("#result [role=alert]").count()
    out["spring_checks"]=pg.locator("#result li:has(svg path)").count()
    pg.screenshot(path=f"/tmp/shots/{tag}_5result.png")
    pg.screenshot(path=f"/tmp/shots/{tag}_full.png", full_page=True)
    out["hscroll"]=pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth")
    out["console"]=errs[:6]
    res[tag]=out; b.close()
with sync_playwright() as p:
    for s in ["delay","cancellation","infeasible","error"]:
        run(p,s,1280,800,f"d_{s}")
    run(p,"delay",390,844,"m_delay"); run(p,"infeasible",390,844,"m_infeasible"); run(p,"delay",1280,800,"rm_delay",reduced=True)
print(json.dumps(res,indent=1))

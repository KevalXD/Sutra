import json, sys
from playwright.sync_api import sync_playwright
B="http://localhost:3300"; AXE="/tmp/node_modules/axe-core/axe.min.js"
res={"axe":{}, "keyboard":{}, "reduced":{}}
def axe(pg,tag):
    pg.add_script_tag(path=AXE)
    r=pg.evaluate("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}}).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,t:v.nodes[0].target.join(' ').slice(0,90),s:(v.nodes[0].any[0]||{}).message?.slice(0,140)})))")
    res["axe"][tag]=r
def flow_to(pg,steps):
    for name in steps:
        pg.get_by_role("button",name=name).first.click(); pg.wait_for_timeout(1300)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":900})
    # ---- axe at each state (delay)
    pg.goto(f"{B}/?scenario=delay"); pg.get_by_role("button",name="Simulate disruption").first.wait_for(); pg.wait_for_timeout(800); axe(pg,"trip")
    pg.get_by_role("button",name="Simulate disruption").first.click(); pg.wait_for_timeout(1500)
    pg.get_by_role("button",name="View affected bookings").click(); pg.wait_for_timeout(400); axe(pg,"disruption+affected_open")
    pg.get_by_role("button",name="Analyze impact").first.click(); pg.wait_for_timeout(2800); axe(pg,"impact")
    pg.get_by_role("button",name="Find recovery").first.click(); pg.wait_for_timeout(900); axe(pg,"recovery_analysis")
    pg.wait_for_selector("#result h2",timeout=15000); pg.wait_for_timeout(2800); axe(pg,"result_feasible")
    pg.get_by_role("button",name="Inspect itinerary").first.click(); pg.wait_for_timeout(500); axe(pg,"result_inspect_open")
    pg.goto(f"{B}/?scenario=infeasible"); pg.get_by_role("button",name="Simulate disruption").first.click(); pg.wait_for_timeout(1200)
    pg.get_by_role("button",name="Analyze impact").first.click(); pg.wait_for_timeout(1200); pg.get_by_role("button",name="Find recovery").first.click()
    pg.wait_for_selector("#result [role=alert]",timeout=15000); pg.wait_for_timeout(1800); axe(pg,"no_feasible")
    pg.goto(f"{B}/?scenario=error"); pg.get_by_text("load this journey").wait_for(); pg.wait_for_timeout(600); axe(pg,"technical_error")

    # ---- keyboard-only
    pg.goto(f"{B}/?scenario=delay"); pg.get_by_role("button",name="Simulate disruption").first.wait_for(); pg.wait_for_timeout(600)
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    order=[]; bad_focus=[]
    def info():
        return pg.evaluate("""(()=>{const e=document.activeElement; if(!e||e===document.body) return null; const cs=getComputedStyle(e);
          const name=(e.getAttribute('aria-label')||e.innerText||e.textContent||'').trim().replace(/\\s+/g,' ').slice(0,40);
          const vis = cs.outlineStyle!=='none' && parseFloat(cs.outlineWidth)>0 && e.matches(':focus-visible');
          return {tag:e.tagName.toLowerCase(), name, vis}})()""")
    def tab_to(sub, maxn=80):
        for _ in range(maxn):
            pg.keyboard.press("Tab"); i=info()
            if i:
                order.append(f"{i['tag']}:{i['name']}")
                if not i["vis"]: bad_focus.append(f"{i['tag']}:{i['name']}")
                if sub.lower() in i["name"].lower(): return True
        return False
    ok=[]
    ok.append(("tab→Simulate disruption", tab_to("Simulate disruption"))); pg.keyboard.press("Enter"); pg.wait_for_timeout(1400)
    ok.append(("tab→View affected bookings", tab_to("View affected bookings"))); pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
    ok.append(("expanded", pg.get_by_role("button",name="View affected bookings").get_attribute("aria-expanded")=="true"))
    ok.append(("tab→Show in journey", tab_to("Show in journey"))); pg.keyboard.press("Enter"); pg.wait_for_timeout(600)
    ok.append(("pressed", pg.get_by_role("button",name="Hide in journey").count()>=1))
    ok.append(("tab→Analyze impact", tab_to("Analyze impact"))); pg.keyboard.press("Enter"); pg.wait_for_timeout(2500)
    ok.append(("tab→Find recovery", tab_to("Find recovery"))); pg.keyboard.press("Enter")
    pg.wait_for_selector("#result h2",timeout=15000); pg.wait_for_timeout(2500)
    ok.append(("tab→Inspect itinerary", tab_to("Inspect itinerary"))); pg.keyboard.press("Space"); pg.wait_for_timeout(400)
    ok.append(("inspect expanded", pg.locator("#comparison button[aria-expanded=true]").count()==1))
    ok.append(("tab→Start over", tab_to("Start over"))); pg.keyboard.press("Enter"); pg.wait_for_timeout(1200)
    ok.append(("restart → trip", pg.get_by_role("button",name="Simulate disruption").first.is_visible()))
    res["keyboard"]={"steps":ok,"elements_missing_visible_focus":sorted(set(bad_focus)),"first_focus_order":order[:14]}

    # headings / landmarks
    res["structure"]=pg.evaluate("""({lang:document.documentElement.lang,h1:document.querySelectorAll('h1').length,
      landmarks:['header','main','nav','footer'].map(t=>t+':'+document.querySelectorAll(t).length),
      imgsNoAlt:[...document.querySelectorAll('img:not([alt])')].length,
      buttonsNoName:[...document.querySelectorAll('button')].filter(b=>!(b.innerText||b.getAttribute('aria-label')||'').trim()).length})""")
    b.close()
    # ---- reduced motion
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1280,"height":900},reduced_motion="reduce"); pg=ctx.new_page()
    pg.goto(f"{B}/?scenario=delay"); pg.get_by_role("button",name="Simulate disruption").first.wait_for(); w0=pg.locator("h1").inner_text(); pg.wait_for_timeout(3600); w1=pg.locator("h1").inner_text()
    res["reduced"]["hero_word_static"]= (w0==w1)
    pg.get_by_role("button",name="Simulate disruption").first.click(); pg.wait_for_timeout(1200); pg.get_by_role("button",name="Analyze impact").first.click(); pg.wait_for_timeout(900)
    pg.get_by_role("button",name="Find recovery").first.click(); pg.wait_for_selector("#result h2",timeout=15000); pg.wait_for_timeout(700)
    res["reduced"]["infinite_animations_running"]=pg.evaluate("document.getAnimations().filter(a=>a.playState==='running'&&a.effect&&a.effect.getComputedTiming().iterations===Infinity).length")
    res["reduced"]["scroll_behavior"]=pg.evaluate("getComputedStyle(document.documentElement).scrollBehavior")
    res["reduced"]["timeline_all_marks_at_once"]=pg.evaluate("document.querySelectorAll('ol[aria-label=\"Repair sequence\"] svg path').length")
    b.close()
print(json.dumps(res,indent=1))

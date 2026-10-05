import sys, json
from playwright.sync_api import sync_playwright
W=int(sys.argv[1]); H=900 if W>=1024 else 844
B="http://localhost:3300"; out={"width":W,"overflow":{}, "dock_in_view":{}, "console":[]}
def chk(pg,tag):
    out["overflow"][tag]=pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    r=pg.evaluate("(()=>{const n=document.querySelector('nav[aria-label=\"Recovery workflow\"] > div');if(!n)return null;const b=n.getBoundingClientRect();return [Math.round(b.left),Math.round(b.right),window.innerWidth]})()")
    out["dock_in_view"][tag]=r
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":W,"height":H})
    pg.on("console", lambda m: out["console"].append(m.text[:120]) if m.type in("error","warning") else None); pg.on("pageerror", lambda e: out["console"].append("PAGEERROR "+str(e)[:120]))
    pg.goto(f"{B}/?scenario=delay"); pg.get_by_role("button",name="Simulate disruption").first.wait_for(); pg.wait_for_timeout(700)
    chk(pg,"hero"); pg.screenshot(path=f"/tmp/shots2/{W}_hero.png")
    pg.get_by_role("button",name="Simulate disruption").first.click(); pg.get_by_role("button",name="Analyze impact").first.wait_for(); pg.wait_for_timeout(900)
    chk(pg,"disruption"); pg.locator("#trip").screenshot(path=f"/tmp/shots2/{W}_journey_disrupted.png")
    # affected bookings interaction
    pg.get_by_role("button",name="View affected bookings").click(); pg.wait_for_timeout(300)
    pg.get_by_role("button",name="Show in journey").nth(1).click(); pg.wait_for_timeout(900)
    out["highlight_ring"]=pg.locator("#trip-booking-F2").evaluate("e=>{const c=e.querySelector('div.rounded-\\\\[14px\\\\]');return getComputedStyle(c).boxShadow.slice(0,60)}")
    chk(pg,"affected"); pg.screenshot(path=f"/tmp/shots2/{W}_affected.png")
    pg.get_by_role("button",name="Analyze impact").first.click(); pg.get_by_role("button",name="Find recovery").first.wait_for(); pg.wait_for_timeout(2300)
    chk(pg,"impact"); pg.locator("#impact").screenshot(path=f"/tmp/shots2/{W}_impact.png")
    pg.get_by_role("button",name="Find recovery").first.click(); pg.wait_for_timeout(900)
    chk(pg,"analysis"); pg.screenshot(path=f"/tmp/shots2/{W}_analysis.png")
    pg.wait_for_selector("#result h2",timeout=15000); pg.wait_for_timeout(2600)
    chk(pg,"result"); pg.locator("#comparison").screenshot(path=f"/tmp/shots2/{W}_comparison.png"); pg.locator("#result").screenshot(path=f"/tmp/shots2/{W}_result.png")
    # no-feasible
    pg.goto(f"{B}/?scenario=infeasible"); pg.get_by_role("button",name="Simulate disruption").first.click()
    pg.get_by_role("button",name="Analyze impact").first.click(); pg.get_by_role("button",name="Find recovery").first.click()
    pg.wait_for_selector("#result [role=alert]",timeout=15000); pg.wait_for_timeout(1500); chk(pg,"nofeasible"); pg.locator("#result").screenshot(path=f"/tmp/shots2/{W}_nofeasible.png")
    # technical error
    pg.goto(f"{B}/?scenario=error"); pg.get_by_text("load this journey").wait_for(); pg.wait_for_timeout(500); chk(pg,"error"); pg.screenshot(path=f"/tmp/shots2/{W}_error.png")
    b.close()
print(json.dumps(out))

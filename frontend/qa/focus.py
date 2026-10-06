from playwright.sync_api import sync_playwright
B="http://localhost:3300"
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":900})
    pg.goto(f"{B}/?scenario=delay"); pg.get_by_role("button",name="Simulate disruption").first.wait_for(); pg.wait_for_timeout(600)
    name=lambda: pg.evaluate("(()=>{const e=document.activeElement;return e&&e!==document.body?(e.tagName.toLowerCase()+': '+(e.innerText||'').trim().replace(/\\s+/g,' ').slice(0,38)):'BODY'})()")
    def tab_to(sub):
        for _ in range(40):
            pg.keyboard.press("Tab")
            if sub in name(): return True
        return False
    for step,wait in [("Simulate disruption",1700),("Analyze impact",2600),("Find recovery",0)]:
        assert tab_to(step), step
        pg.keyboard.press("Enter")
        if step=="Find recovery": pg.wait_for_selector("#result h2",timeout=15000)
        pg.wait_for_timeout(wait or 2200)
        print(f"after '{step}' → focus: {name()}")
        pg.keyboard.press("Tab"); print("   next Tab →", name())
    b.close()

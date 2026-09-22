import re, base64, pathlib, json

def b64d(s):
    try: return base64.b64decode(s).decode().strip()
    except: return f"BAD:{s}"

def check_file(path):
    t=open(path,encoding='utf-8').read()
    print("="*80)
    print(path)
    # extract quizzes
    quiz_blocks = re.findall(r'<div class="quiz-gate[^>]*id="([^"]+)"[^>]*data-k="([^"]+)"[^>]*>.*?<div class="quiz-question">(.*?)</div>.*?<div class="quiz-options">(.*?)</div>', t, flags=re.DOTALL)
    for qid, k, qtext, opts in quiz_blocks:
        correct = b64d(k)
        opts_list = re.findall(r'<span>(.*?)</span>', opts)
        # also get letters
        print(f"\n QUIZ {qid} k={k} -> {correct} q={re.sub('<[^>]+>','',qtext)[:80]}")
        for idx, opt in enumerate(opts_list):
            clean = re.sub('<[^>]+>','',opt).strip()[:60]
            marker = " <--- CORRECT" if str(idx)==correct else ""
            print(f"   [{idx}] {clean}{marker}")
        # verify correct is numeric and within range
        try:
            ci=int(correct)
            if ci >= len(opts_list): print("   ERROR: correct index out of range!")
        except: print("   ERROR: correct not int!")

    # order challenges
    oc_blocks = re.findall(r'<div class="order-challenge"[^>]*>.*?</div>\s*<div class="oc-feedback"', t, flags=re.DOTALL)
    oc_items = re.findall(r'<div class="oc-item" data-k="([^"]+)"[^>]*><span class="oc-num"></span><span>(.*?)</span>', t)
    if oc_items:
        print("\n ORDER ITEMS:")
        for k, txt in oc_items:
            clean=re.sub('<[^>]+>','',txt).strip()
            dec=b64d(k)
            print(f"  k={k} -> {dec} : {clean[:60]}")
            if k=="NA==": print("   WARNING: NA placeholder - should be actual order number!")
    # tf
    tf_blocks = re.findall(r'<div class="tf-item" data-a="([^"]+)">\s*<div class="tf-statement">(.*?)</div>', t, flags=re.DOTALL)
    if tf_blocks:
        print("\n TF ITEMS:")
        for a, stmt in tf_blocks:
            dec=b64d(a)
            clean=re.sub('<[^>]+>','',stmt).strip()[:70]
            print(f"  a={a}->{dec}: {clean}")

    # cc blanks
    cc_blanks = re.findall(r'<input class="cc-blank" data-a="([^"]+)"', t)
    print("\n CC blanks decoded:", [b64d(x) for x in cc_blanks])
    cf_blanks = re.findall(r'<input class="cf-blank" data-a="([^"]+)"', t)
    print(" CF blanks decoded:", [b64d(x) for x in cf_blanks])

    # check for missing player profile XP reporting
    has_complete = "completeStep" in t
    print(" has completeStep:", has_complete)
    # check storage key uniqueness
    m=re.search(r"STORAGE_KEY = '([^']+)'", t)
    print(" STORAGE_KEY:", m.group(1) if m else "MISSING")
    # check for beginner-proof elements
    for phrase in ["Parent", "Grown-up", "Stuck", "Troubleshoot", "Anchored", "What is Godot", "What is Roblox", "Prerequisites", "Install", "Try it"]:
        print(f"  contains '{phrase}':", phrase.lower() in t.lower())
    # check for broken quiz data-k NA
    if "NA==" in t:
        print("  *** HAS NA== placeholder ***")
    print()

for p in ['F:/Website/Jvdesign-Website-v2/workshops/godot-racing-workshop.html', 'F:/Website/Jvdesign-Website-v2/workshops/roblox-collapse-obby-workshop.html', 'F:/Website/Jvdesign-Website-v2/workshops/godot-racing-workshop-2.html', 'F:/Website/Jvdesign-Website-v2/workshops/roblox-corruption-obby-workshop.html']:
    check_file(p)

# Biscuit Tycoon: the 7 steps

This is the same path as the workshop on the site. Open `bakery.gd`, find the
function named in each step, and add the code. The scene and every signal are
already wired, so you do not need to connect anything.

Press F5 after each step to play.

## Step 1: The Big Biscuit

Find `func on_tap():` and replace `pass` with:

```gdscript
biscuits += click_power
```

Check: click TAP THE TIN. The biscuit label goes up by one.

## Step 2: Biscuits per Second

Find `func biscuits_per_second():` and replace `return 0.0` with:

```gdscript
return auto_tappers * auto_power
```

Check: the label at the top right shows the rate. It updates every frame.

## Step 3: Hire an Auto Tapper

Find `func auto_tick(delta):` and replace `pass` with:

```gdscript
biscuits += auto_tappers * auto_power * delta
```

For a quick test, change `var auto_tappers = 0` to `var auto_tappers = 1` at the
top of the script. Press F5 and watch the biscuit count climb.

## Step 4: Open the Upgrade Shop

Find `func buy_auto_tapper():` and replace `pass` with:

```gdscript
if biscuits >= auto_cost:
	biscuits -= auto_cost
	auto_tappers += 1
	auto_cost = roundi(auto_cost * 1.6)
```

Check: earn 50 biscuits by tapping, then press AUTO TAPPER. The cost rises to 80.

## Step 5: Faster Tappers

Find `func buy_faster_tapper():` and replace `pass` with:

```gdscript
if biscuits >= faster_cost:
	biscuits -= faster_cost
	auto_power += 1
	faster_cost = roundi(faster_cost * 2.5)
```

Check: earn 250 biscuits, then press FASTER TAPPER. The rate jumps.

## Step 6: Golden Biscuit

Find `func golden_bonus():` and replace `pass` with:

```gdscript
biscuits += max(25, round(auto_tappers * auto_power * 10))
```

Check: wait 14 seconds for the GOLDEN button. Click it. The bonus is added and
the button hides.

## Step 7: Take It Home

Press F5 and check the tap, the auto tapper, both shop buttons and the golden
biscuit. Then open Project > Export, add a Windows Desktop or Web preset, and
choose Export Project. Keep the whole export folder.

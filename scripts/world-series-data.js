/*
 * world-series-data.js
 * Content for the generated "World Workshop" episode pages.
 * Each series is an ordered set of episodes; each episode is an ordered set of
 * steps. See scripts/generate-world-series.js for the renderer.
 *
 * Fill sentences may contain [answer|size] tokens, which become blanks.
 * Quiz "correct" is the 0-based index of the right option.
 */

const OPENRCT2 = {
  id: 'openrct2-world',
  title: 'OpenRCT2 World Workshop',
  engine: 'OpenRCT2',
  pillEmoji: '🎢',
  themeColor: '#d94f3d',
  css: 'style-workshop-openrct2-world-workshop.css',
  hub: 'openrct2-world-workshop.html',
  og: 'openrct2-world-workshop',
  episodes: [
    {
      slug: 'openrct2-world-ep1-setup',
      num: 1, level: 'Beginner',
      heroLine1: 'Open the Gates', title: 'Episode 1: Get Set Up',
      cta: '🎢 Start Step 1',
      badge: '🎢 Episode 1 · Beginner · Setup',
      sub: 'Before you can change the park, you need the park running and a place to put your mods. By the end of this episode OpenRCT2 is installed, you know where plugins live, and you have a plan for the whole series.',
      mins: '~40 mins',
      skills: [['📥', 'Install OpenRCT2'], ['📁', 'Find the plugin folder'], ['🧩', 'How a mod fits'], ['🗺️', 'Plan the build']],
      intro: [
        { k: 'warn', icon: '🛡️', html: '<strong>Get a grown-up:</strong> installing OpenRCT2 and pointing it at your copy of RollerCoaster Tycoon 2 is a home-computer job. Do this part together.' },
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> setup is the least fun and most important part. Do it once, and every episode after this is just writing a few lines and watching the park change.' }
      ],
      steps: [
        {
          emoji: '📥', title: 'Install OpenRCT2', blurb: 'Get the free park builder running',
          goal: 'Have OpenRCT2 open and reading your RollerCoaster Tycoon 2 game files.',
          list: [
            'Go to the official OpenRCT2 website and download the installer for your computer.',
            'Run it, then open OpenRCT2. On first run it asks where your <strong>RollerCoaster Tycoon 2</strong> game is installed. Point it at that folder.',
            'Open any park and make sure it loads and runs.',
            'That is the hard part done. OpenRCT2 is a free remake, but it still uses the original game art, so keep the game installed.'
          ],
          quiz: { q: 'What does OpenRCT2 need before it can show any rides or scenery?', opts: ['A paid subscription', 'Your own copy of RollerCoaster Tycoon 2 for the original art and data', 'Nothing at all'], correct: 1 }
        },
        {
          emoji: '📁', title: 'Find the Plugin Folder', blurb: 'The one folder where your mods live',
          goal: 'Find the folder OpenRCT2 watches for plugins, and know how to open it from the game.',
          list: [
            'In OpenRCT2, turn on the <strong>developer tools</strong> (usually a helpful shortcut like Ctrl+D, or from the options menu).',
            'Choose <strong>Open custom content folder</strong>, then <strong>Open plugin folder</strong>.',
            'On Windows it lives in <strong>Documents / OpenRCT2 / plugin</strong>.',
            'Every mod you write goes here as its own <strong>.js</strong> file. That is the whole install: drop a file in a folder.'
          ],
          quiz: { q: 'How do you install a plugin in OpenRCT2?', opts: ['Compile it into the game', 'Drop a .js file into the plugin folder', 'Email it to the developers'], correct: 1 }
        },
        {
          emoji: '🗺️', title: 'See the Whole Journey', blurb: 'What you will build across the series',
          goal: 'Know the arc: from a hello-world plugin to a real park tool you can share.',
          list: [
            'Episodes 2 and 3 get a plugin loading and reacting to the park with messages.',
            'Episodes 4 and 5 read the real park: money, guests, rides.',
            'Episode 6 builds a practical tool that rescues guests from water.',
            'Episodes 7 and 8 make it solid, then package and share it.'
          ],
          fill: { sentence: 'The whole series ends with a park tool you can [share|6] with other players.' },
          quiz: { q: 'What is the final goal of the series?', opts: ['A paid DLC pack', 'A park tool or plugin you made yourself and can share', 'A new game engine'], correct: 1 }
        },
        {
          emoji: '🧰', title: 'Ready Check', blurb: 'The toolkit you now have',
          goal: 'Confirm the four things every later episode assumes.',
          list: [
            'OpenRCT2 opens and loads a park.',
            'You can find the plugin folder.',
            'You can create and save a plain text file with a .js ending.',
            'You have a plain text editor (Notepad, TextEdit, or VS Code).'
          ],
          fill: { sentence: 'Plugins are plain text files, so any text [editor|6] will do.' },
          quiz: { q: 'What kind of program is OpenRCT2?', opts: ['A paid game', 'A free, open-source remake of RollerCoaster Tycoon 2', 'A website'], correct: 1 }
        }
      ],
      finishTitle: 'The Park is Open!',
      finishSub: 'You have OpenRCT2 running and you know exactly where your mods go. That is the foundation for everything else.',
    },
    {
      slug: 'openrct2-world-ep2-first-plugin',
      num: 2, level: 'Beginner',
      heroLine1: 'Hello, Park', title: 'Episode 2: Your First Plugin',
      cta: '📜 Write Step 1',
      badge: '🎢 Episode 2 · Beginner · First Code',
      sub: 'Time for your first line of real code. You will write a tiny plugin, watch the game load it, and read its message in the console. This is the moment you become a modder.',
      mins: '~40 mins',
      skills: [['📜', 'registerPlugin'], ['🖥️', 'console.log'], ['🔔', 'Events'], ['✅', 'Load check']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> a plugin is one function plus a registration call. That is it. Do not worry about the big words, we will meet them one at a time.' }
      ],
      steps: [
        {
          emoji: '📦', title: 'What a Plugin Is', blurb: 'One function, one registration',
          goal: 'Understand the two parts every plugin has.',
          list: [
            'A <strong>.js</strong> file holds your code.',
            'A function (called <strong>main</strong>) is the work you want done.',
            '<strong>registerPlugin</strong> tells OpenRCT2 the plugin exists and points it at your function.'
          ],
          fill: { sentence: 'The function the game runs is usually called [main|4], and it is announced with [registerPlugin|14].' },
          quiz: { q: 'What are the two parts of every plugin?', opts: ['A function and a registerPlugin call', 'A sprite and a sound', 'A username and a password'], correct: 0 }
        },
        {
          emoji: '✍️', title: 'Write hello.js', blurb: 'Four lines that prove it works',
          goal: 'Save a working plugin in your plugin folder.',
          list: [
            'Open your text editor and create a new file.',
            'Type the code below exactly.',
            'Save it inside your plugin folder as <strong>hello.js</strong>. Make sure it is not hello.js.txt.'
          ],
          code: 'function main() {\n  console.log("Hello park! My first plugin is running.");\n}\n\nregisterPlugin({\n  name: "Hello Park",\n  version: "1.0",\n  authors: ["Your Name"],\n  type: "local",\n  main: main\n});',
          quiz: { q: 'Which property points to the function to run?', opts: ['start', 'main', 'run'], correct: 1 }
        },
        {
          emoji: '🔔', title: 'React to the Park', blurb: 'Run code when something happens',
          goal: 'Make your plugin do something when a new day starts.',
          list: [
            'OpenRCT2 gives you <strong>events</strong> you can listen to, like <em>interval.day</em>.',
            '<strong>context.subscribe</strong> attaches your code to an event.',
            '<strong>park.postMessage</strong> shows a message in the game, like a park announcement.'
          ],
          code: 'function main() {\n  context.subscribe("interval.day", function () {\n    park.postMessage("A new day dawns in your park!");\n  });\n}\n\nregisterPlugin({\n  name: "Daily Greeting",\n  version: "1.0",\n  authors: ["Your Name"],\n  type: "local",\n  main: main\n});',
          fill: { sentence: 'You attach to an event with context.[subscribe|9] and show a message with park.[postMessage|11].' },
          quiz: { q: 'What does context.subscribe do?', opts: ['Buys a season pass', 'Runs your code when a chosen event happens', 'Deletes your park'], correct: 1 }
        },
        {
          emoji: '✅', title: 'Check It Loaded', blurb: 'Read the plugin manager',
          goal: 'Prove the game loaded your file and ran your code.',
          list: [
            'Open the <strong>Plugin Manager</strong> from the developer tools. Your plugin should be listed.',
            'Open the game <strong>console</strong> and find your printed message.',
            'If it is missing: check the file is in the plugin folder and ends in .js (not .txt).',
            'Fix any missing bracket or quote and save again.'
          ],
          fill: { sentence: 'A plugin with a missing bracket will not [load|4].' },
          quiz: { q: 'Your plugin is not listed. Most likely cause?', opts: ['The PC is too slow', 'The file is in the wrong folder or ends up as .js.txt', 'Plugins only work at night'], correct: 1 }
        },
        {
          emoji: '🎨', title: 'Make It Yours', blurb: 'Change the words, make it personal',
          goal: 'Edit the message and the plugin name.',
          list: [
            'Change the name to something with your own style.',
            'Change the message to greet your park by its name.',
            'Save, reload, and watch it appear.'
          ],
          fill: { sentence: 'Small changes are the best way to [learn|5] how the code works.' },
          quiz: { q: 'What is the best way to learn what a line does?', opts: ['Change it and see what happens', 'Never touch it', 'Delete the file'], correct: 0 }
        }
      ],
      finishTitle: 'You Are a Modder!',
      finishSub: 'You wrote a plugin, the engine loaded it, and it reacted to the park. Next you will make it post messages on your command.',
    },
    {
      slug: 'openrct2-world-ep3-events',
      num: 3, level: 'Beginner',
      heroLine1: 'Talk to the Park', title: 'Episode 3: Events and Messages',
      cta: '🔔 Start Step 1',
      badge: '🎢 Episode 3 · Beginner · Events',
      sub: 'Plugins come alive when they react to the park. You will learn the events OpenRCT2 offers and make your plugin send different messages at different times.',
      mins: '~45 mins',
      skills: [['🔔', 'Event types'], ['⏱️', 'Time events'], ['💬', 'Messages'], ['🧪', 'Test the timing']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> events are the door between your code and the living park. Pick the right event and your plugin feels like it has been part of the game all along.' }
      ],
      steps: [
        {
          emoji: '🔔', title: 'Meet the Events', blurb: 'The park broadcasts, you listen',
          goal: 'Know three useful events and when they fire.',
          list: [
            '<strong>interval.tick</strong> fires many times a second. Good for smooth checks, easy to overload.',
            '<strong>interval.day</strong> fires once per in-game day. Good for slow, gentle logic.',
            '<strong>ride.ratings.calculate</strong> fires when the game rates a ride. Good for reacting to builds.'
          ],
          quiz: { q: 'Which event fires once per in-game day?', opts: ['interval.tick', 'interval.day', 'ride.ratings.calculate'], correct: 1 }
        },
        {
          emoji: '⏱️', title: 'Pick the Right Speed', blurb: 'Do not run too often',
          goal: 'Choose events that match how often your code needs to run.',
          list: [
            'Anything on <strong>interval.tick</strong> runs constantly. Keep it tiny.',
            'Anything on <strong>interval.day</strong> runs rarely. It can do a bit more.',
            'Rule of thumb: use the slowest event that still does the job.'
          ],
          fill: { sentence: 'For a job that only needs to run once a day, use interval.[day|3].' },
          quiz: { q: 'Why avoid putting heavy code on interval.tick?', opts: ['It runs so often it can slow the game down', 'It only runs once', 'It deletes your save'], correct: 0 }
        },
        {
          emoji: '💬', title: 'Different Messages', blurb: 'Make the park talk',
          goal: 'Send a different message each time the event fires.',
          list: [
            'Keep a counter in your plugin that grows each time the event runs.',
            'Pick a message based on the counter.',
            'Use park.postMessage to show it.'
          ],
          code: 'var days = 0;\nfunction main() {\n  context.subscribe("interval.day", function () {\n    days++;\n    park.postMessage("Day " + days + " in the park!");\n  });\n}\nregisterPlugin({ name: "Day Counter", version: "1.0", authors: ["You"], type: "local", main: main });',
          fill: { sentence: 'We store the day count in a [variable|8] so it can grow each time.' },
          quiz: { q: 'How does the plugin remember the day count between events?', opts: ['It keeps it in a variable', 'It guesses', 'It asks the player'], correct: 0 }
        },
        {
          emoji: '🧪', title: 'Test the Timing', blurb: 'Watch it happen',
          goal: 'Confirm your message appears once per day.',
          list: [
            'Load a park and let a few days pass.',
            'Watch the console and the in-game messages.',
            'If it fires too often, you are on the wrong event.'
          ],
          quiz: { q: 'Your message appears many times a second. What is wrong?', opts: ['You used interval.tick instead of a slower event', 'Your message is too long', 'The park is broken'], correct: 0 }
        },
        {
          emoji: '🎨', title: 'Design a Little Life', blurb: 'Give the park personality',
          goal: 'Invent three messages the park might say at different moments.',
          list: [
            'A cheerful morning message.',
            'A busy-weekend message.',
            'A gentle reminder to tidy the paths.'
          ],
          fill: { sentence: 'Messages are written for [players|7], so keep them short and friendly.' },
          quiz: { q: 'Who is the message really for?', opts: ['The player', 'The compiler', 'The developer toolbar'], correct: 0 }
        }
      ],
      finishTitle: 'The Park Has a Voice!',
      finishSub: 'Your plugin reacts to the park on a timer. Next you will read the real park data: money, guests and rides.',
    },
    {
      slug: 'openrct2-world-ep4-read-the-park',
      num: 4, level: 'Improver',
      heroLine1: 'Read the Park', title: 'Episode 4: Money, Guests and Rides',
      cta: '📊 Start Step 1',
      badge: '🎢 Episode 4 · Improver · Data',
      sub: 'Now your plugin can read the park itself. You will look at cash, park rating, how many guests are inside, and the rides they are queuing for.',
      mins: '~50 mins',
      skills: [['💰', 'Park cash'], ['⭐', 'Park rating'], ['🧍', 'Guest count'], ['🎡', 'Ride stats']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> reading data is what turns a toy into a tool. Once your plugin knows the numbers, it can give advice, or act on its own.' }
      ],
      steps: [
        {
          emoji: '💰', title: 'Read the Cash', blurb: 'How much money is in the park',
          goal: 'Print the park cash to the console.',
          list: [
            'The park object holds the money as <strong>park.cash</strong>.',
            'Money is stored in the smallest unit, so you divide to show pounds or dollars.',
            'Print it with console.log so you can see it.'
          ],
          code: 'context.subscribe("interval.day", function () {\n  console.log("Cash now: " + Math.round(park.cash / 10) / 100);\n});',
          fill: { sentence: 'The park cash is found at park.[cash|4].' },
          quiz: { q: 'Where does your plugin read the park money?', opts: ['park.cash', 'park.money', 'cash.park'], correct: 0 }
        },
        {
          emoji: '⭐', title: 'Read the Rating', blurb: 'How happy the park is',
          goal: 'Show the park rating each day.',
          list: [
            'The rating is a number out of 1000 in the park object.',
            'It rises when guests are happy and falls when they are not.',
            'Print it alongside the cash for a little dashboard.'
          ],
          fill: { sentence: 'The park rating is a number out of [1000|4].' },
          quiz: { q: 'A park rating of 1000 means what?', opts: ['Bankrupt', 'The best possible happiness', 'Closed'], correct: 1 }
        },
        {
          emoji: '🧍', title: 'Count the Guests', blurb: 'Everyone in the park',
          goal: 'Count the guests using the map API.',
          list: [
            '<strong>map.getAllEntities("guest")</strong> returns every guest.',
            'Its length is the guest count.',
            'You can loop over them to look at each one.'
          ],
          code: 'var guests = map.getAllEntities("guest");\nconsole.log("Guests in park: " + guests.length);',
          fill: { sentence: 'To get every guest, call map.getAllEntities("[guest|5]").' },
          quiz: { q: 'What does map.getAllEntities("guest") give you?', opts: ['A single guest', 'A list of all guests', 'The park owner'], correct: 1 }
        },
        {
          emoji: '🎡', title: 'Look at the Rides', blurb: 'What people are queuing for',
          goal: 'Spot the busiest ride.',
          list: [
            '<strong>map.getAllEntities("ride")</strong> returns every ride.',
            'Each ride has a name and a queue length.',
            'Find the longest queue and post a helpful message about it.'
          ],
          fill: { sentence: 'A long ride [queue|5] is a sign the ride is popular.' },
          quiz: { q: 'Why might a plugin watch queue lengths?', opts: ['To close busy rides', 'To spot what guests love and tell the player', 'To delete the ride'], correct: 1 }
        },
        {
          emoji: '🧪', title: 'Build a Tiny Dashboard', blurb: 'Put the numbers together',
          goal: 'Post one message with cash, rating and guest count.',
          list: [
            'Combine the three readings into one string.',
            'Post it once per day.',
            'Run a park and watch your dashboard update.'
          ],
          fill: { sentence: 'A dashboard combines several [numbers|7] into one message.' },
          quiz: { q: 'What makes a good dashboard message?', opts: ['Short, clear numbers the player cares about', 'One very long paragraph', 'No numbers at all'], correct: 0 }
        }
      ],
      finishTitle: 'Your Plugin Can See!',
      finishSub: 'You can read cash, rating, guests and rides. Next you will act on guests directly.',
    },
    {
      slug: 'openrct2-world-ep5-guests',
      num: 5, level: 'Improver',
      heroLine1: 'Help the Guests', title: 'Episode 5: Working with Guests',
      cta: '🧍 Start Step 1',
      badge: '🎢 Episode 5 · Improver · Guests',
      sub: 'Guests are entities with a position, a mood and a mind of their own. You will find guests who need help and change what happens to them.',
      mins: '~50 mins',
      skills: [['👀', 'Find guests'], ['📍', 'Positions'], ['❤️', 'Mood'], ['🛟', 'Change behaviour']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> a guest is just an object with properties like x, y and happiness. Learn to find the ones you care about, and the rest is action.' }
      ],
      steps: [
        {
          emoji: '👀', title: 'Find the Right Guest', blurb: 'Loop and filter',
          goal: 'Loop over guests and pick out the unhappy ones.',
          list: [
            'Get all guests with map.getAllEntities("guest").',
            'Each guest has a <strong>happiness</strong> value.',
            'Collect the ones below a threshold into a shortlist.'
          ],
          code: 'var guests = map.getAllEntities("guest");\nvar sad = guests.filter(function (g) { return g.happiness < 100; });',
          fill: { sentence: 'We use filter to keep only the guests who are [unhappy|7].' },
          quiz: { q: 'What does the filter here do?', opts: ['Removes all guests', 'Keeps only the guests matching the test', 'Adds new guests'], correct: 1 }
        },
        {
          emoji: '📍', title: 'Where Is a Guest?', blurb: 'x, y and z',
          goal: 'Read a guest position.',
          list: [
            'Every entity has <strong>x</strong>, <strong>y</strong> and <strong>z</strong> coordinates.',
            'z is the height above the ground.',
            'These let you spot guests in odd places, like the water.'
          ],
          fill: { sentence: 'A guest position has x, y and [z|1] coordinates.' },
          quiz: { q: 'Which coordinate is the height above the ground?', opts: ['x', 'y', 'z'], correct: 2 }
        },
        {
          emoji: '🛟', title: 'Act on a Guest', blurb: 'Change what happens',
          goal: 'Teleport a guest to safety.',
          list: [
            'You can set a guest position with the entity API.',
            'Move the guest to the nearest path tile.',
            'Post a message so the player knows you helped.'
          ],
          code: 'g.setCoordinates(safeX, safeY, safeZ);\npark.postMessage("Rescued a soggy guest!");',
          fill: { sentence: 'We set a guest position with set[Coordinates|12].' },
          quiz: { q: 'What is a friendly way to use powers over guests?', opts: ['Help guests in trouble', 'Scare everyone away', 'Delete the park'], correct: 0 }
        },
        {
          emoji: '❤️', title: 'Track the Mood', blurb: 'Are guests happy?',
          goal: 'Report how many guests are unhappy.',
          list: [
            'Count the unhappy guests from your shortlist.',
            'If the number is high, tell the player what might help.',
            'Keep the advice kind and specific.'
          ],
          fill: { sentence: 'A good tip is [specific|8], not just "make it better".' },
          quiz: { q: 'Your plugin sees 20 unhappy guests. Best message?', opts: ['"Everyone is unhappy!"', '"20 guests want a bench and a drink nearby."', 'Silence'], correct: 1 }
        },
        {
          emoji: '🧪', title: 'Test a Rescue', blurb: 'Make it happen safely',
          goal: 'Set up a guest near water and watch your rescue work.',
          list: [
            'Load a park with a lake.',
            'Cheat a guest into the water using the developer tools.',
            'Watch your plugin find them and move them out.'
          ],
          quiz: { q: 'Why cheat one guest into the water while testing?', opts: ['To avoid ruining a real park', 'To make the game harder', 'It is required by law'], correct: 0 }
        }
      ],
      finishTitle: 'Guest Guardian!',
      finishSub: 'Your plugin can find guests and help them. Next you build the full Swim Rescue tool.',
    },
    {
      slug: 'openrct2-world-ep6-swim-rescue',
      num: 6, level: 'Advanced',
      heroLine1: 'Save the Guests', title: 'Episode 6: Build Swim Rescue',
      cta: '🛟 Start Step 1',
      badge: '🎢 Episode 6 · Advanced · Full Tool',
      sub: 'This is the big one. You bring together events, guest positions and actions to build a real tool that catches guests in the water and saves them before they get upset.',
      mins: '~1 hour',
      skills: [['🛟', 'Full feature'], ['🧠', 'Logic'], ['⏱️', 'Tick safely'], ['🧪', 'Play-test']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> this is the same idea as the Swim Rescue workshop, but now you understand every piece. Build it once and you will trust it, because it is all yours.' },
        { k: 'tip', icon: '📋', html: 'Want a guided version? The <a href="openrct2-swim-rescue.html"><strong>Swim Rescue workshop</strong></a> walks through a related build step by step.' }
      ],
      steps: [
        {
          emoji: '🗺️', title: 'Plan the Tool', blurb: 'One clear job',
          goal: 'Write one sentence describing exactly what the tool does.',
          list: [
            'Good tools have one clear job.',
            'Ours: "Find guests in water and move them to the nearest path."',
            'Write your sentence before any code.'
          ],
          fill: { sentence: 'A good tool has [one|3] clear job.' },
          quiz: { q: 'Why start with one clear job?', opts: ['So the tool is simple and works', 'So it is longer', 'So it is slower'], correct: 0 }
        },
        {
          emoji: '🧠', title: 'Spot a Guest in Water', blurb: 'The core check',
          goal: 'Decide if a guest is in the water.',
          list: [
            'Each guest has a position and a flag for being in water (or you can check the tile under them).',
            'Only act on guests who are in water.',
            'Leave everyone else alone.'
          ],
          code: 'if (guest.isInWater) {\n  // rescue this guest\n}',
          fill: { sentence: 'We only rescue a guest when guest.isIn[Water|5] is true.' },
          quiz: { q: 'What should the tool do for guests not in water?', opts: ['Ignore them', 'Teleport them too', 'Delete them'], correct: 0 }
        },
        {
          emoji: '🛟', title: 'Send Them to Safety', blurb: 'Find a path and move',
          goal: 'Move the guest to the nearest path tile.',
          list: [
            'Find a safe tile near the water edge.',
            'Set the guest position there.',
            'Post one cheerful message, not one per guest (that would flood the screen).'
          ],
          fill: { sentence: 'Send a guest to the nearest [path|4] tile.' },
          quiz: { q: 'Why save up the messages and post one, not many?', opts: ['So the screen is not flooded', 'Because messages cost money', 'Messages are limited to one forever'], correct: 0 }
        },
        {
          emoji: '⏱️', title: 'Run It Safely', blurb: 'Pick the event',
          goal: 'Choose how often the check runs without hurting performance.',
          list: [
            'Checking water on every tick is safest for catching guests fast, but must be light.',
            'Only look at guests near water if you can, to keep it quick.',
            'Test on a busy park and watch the frame rate.'
          ],
          quiz: { q: 'If the game slows down after adding your tool, what do you check first?', opts: ['How often your code runs', 'The colour of the UI', 'The park name'], correct: 0 }
        },
        {
          emoji: '🧪', title: 'Play-Test It', blurb: 'Break it on purpose',
          goal: 'Try to make the tool fail, then fix it.',
          list: [
            'Drop guests in water in several places.',
            'Put a guest in water with no nearby path.',
            'Fix the odd case so the tool never crashes.'
          ],
          fill: { sentence: 'Testing the odd [cases|5] is what makes a tool trustworthy.' },
          quiz: { q: 'What separates a toy from a tool?', opts: ['Handling the odd cases without crashing', 'A longer name', 'More colours'], correct: 0 }
        }
      ],
      finishTitle: 'Swim Rescue Works!',
      finishSub: 'You built a real park tool from scratch. Next you will get it rock solid and handle anything the engine throws at you.',
    },
    {
      slug: 'openrct2-world-ep7-test-debug',
      num: 7, level: 'Advanced',
      heroLine1: 'Make It Solid', title: 'Episode 7: Test and Debug',
      cta: '🔍 Start Step 1',
      badge: '🎢 Episode 7 · Advanced · Debug',
      sub: 'Real modders spend a lot of time reading error messages. In this episode you learn to read the console like a detective, fix the common mistakes, and protect your plugin against crashes.',
      mins: '~45 mins',
      skills: [['🔍', 'Read the log'], ['🧯', 'Common errors'], ['🛡️', 'Guard the code'], ['♻️', 'Reload safely']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> an error is not a failure, it is the engine telling you exactly where to look. The console is your friend.' }
      ],
      steps: [
        {
          emoji: '🔍', title: 'Read the Console', blurb: 'Where errors appear',
          goal: 'Open the console and find the first error line.',
          list: [
            'Open the developer console from the toolbar.',
            'Errors are marked clearly and usually name the file and line.',
            'Always fix the <strong>first</strong> error first; later ones are often caused by it.'
          ],
          quiz: { q: 'Which error should you fix first?', opts: ['The last one', 'The first one', 'A random one'], correct: 1 }
        },
        {
          emoji: '🧯', title: 'The Usual Suspects', blurb: 'Fast fixes',
          goal: 'Recognise the five common mistakes.',
          list: [
            'Missing or extra <strong>bracket</strong> or quote.',
            'A file ending in <strong>.js.txt</strong> instead of .js.',
            'A plugin <strong>name</strong> that clashes with another plugin.',
            'Calling something that does not exist (like a typo in park.postMsg).',
            'Code running too often and slowing the game.'
          ],
          fill: { sentence: 'A very common mistake is a file saved with a hidden .[txt|3] ending.' },
          quiz: { q: 'Your plugin does nothing at all. First thing to check?', opts: ['The file is .js and in the plugin folder', 'The park has enough guests', 'The weather'], correct: 0 }
        },
        {
          emoji: '🛡️', title: 'Guard Your Code', blurb: 'Never crash the game',
          goal: 'Add a check so your code only acts when it is safe.',
          list: [
            'Before using something, check it exists: <strong>if (guest) { ... }</strong>.',
            'Wrap risky sections in try/catch so one bad guest cannot break the whole plugin.',
            'Fail quietly, never crash the park.'
          ],
          code: 'try {\n  // risky work\n} catch (e) {\n  console.log("Skipped one: " + e.message);\n}',
          fill: { sentence: 'We wrap risky code in try / [catch|5] so the plugin keeps running.' },
          quiz: { q: 'Why wrap risky code in try/catch?', opts: ['So one error cannot break the whole plugin', 'To make it longer', 'To slow the game'], correct: 0 }
        },
        {
          emoji: '♻️', title: 'Reload Safely', blurb: 'Change, reload, repeat',
          goal: 'Learn the quick test loop.',
          list: [
            'Save your file, then reload plugins from the plugin manager.',
            'Watch the console for errors after each reload.',
            'Keep changes small so you always know what caused a break.'
          ],
          fill: { sentence: 'Keep each change [small|5] so you know what caused any break.' },
          quiz: { q: 'Why make one small change at a time?', opts: ['So you know what caused a new bug', 'It looks nicer', 'The computer requires it'], correct: 0 }
        },
        {
          emoji: '🎨', title: 'Write a Helper', blurb: 'Tidy code is easy code',
          goal: 'Move repeated code into one helper function.',
          list: [
            'If you write the same lines twice, make a function.',
            'Give it a clear name like <strong>rescueGuest(g)</strong>.',
            'Use it everywhere you need that job done.'
          ],
          fill: { sentence: 'If you write the same lines twice, make a [function|8].' },
          quiz: { q: 'Why pull repeated code into a function?', opts: ['Fix it once, use it everywhere', 'To hide the code', 'To make the file bigger'], correct: 0 }
        }
      ],
      finishTitle: 'Rock Solid!',
      finishSub: 'You can read the log, fix the common errors and keep the game safe. Now let us make it yours and share it.',
    },
    {
      slug: 'openrct2-world-ep8-design-share',
      num: 8, level: 'Capstone',
      heroLine1: 'Make It Yours, Share It', title: 'Episode 8: Design and Share',
      cta: '🚀 Start Step 1',
      badge: '🎢 Episode 8 · Capstone · Share',
      sub: 'The last step is the most satisfying: give your plugin a personality, package it neatly, and share it so other players can drop it into their game.',
      mins: '~45 mins',
      skills: [['🎨', 'Design'], ['📦', 'Package'], ['📝', 'Write a README'], ['🌍', 'Share safely']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> a mod with a friendly name and a clear README gets used. Make it easy for the next player and it will travel.' }
      ],
      steps: [
        {
          emoji: '🎨', title: 'Design the Feel', blurb: 'Name, colour, voice',
          goal: 'Decide what your plugin is called and how it talks.',
          list: [
            'Pick a name that says what it does.',
            'Decide the voice: friendly, funny, calm.',
            'Keep every message in that voice.'
          ],
          fill: { sentence: 'A good name says clearly what the [plugin|6] does.' },
          quiz: { q: 'Why keep a consistent voice in your messages?', opts: ['It feels like one product, not a pile of code', 'It is required', 'It makes it faster'], correct: 0 }
        },
        {
          emoji: '📦', title: 'Package Neatly', blurb: 'One tidy folder',
          goal: 'Put your plugin and any extra files in one clear folder.',
          list: [
            'A single .js is enough, but extra files go in a folder beside it.',
            'Name the folder after the plugin.',
            'Check it works from a fresh copy of the folder.'
          ],
          fill: { sentence: 'Name the folder after the [plugin|6] so it is obvious.' },
          quiz: { q: 'How should a plugin folder be named?', opts: ['After the plugin, so it is obvious', 'folder1', 'Randomly'], correct: 0 }
        },
        {
          emoji: '📝', title: 'Write a README', blurb: 'Help the next player',
          goal: 'Write four short lines explaining your plugin.',
          list: [
            'What it does, in one line.',
            'Where to put the file (the plugin folder).',
            'Any version it needs.',
            'How to turn it off.'
          ],
          fill: { sentence: 'A README should say where to put the [file|4] and how to turn it off.' },
          quiz: { q: 'What belongs in a README?', opts: ['What it does, where to install it, how to disable it', 'Your lunch order', 'Nothing'], correct: 0 }
        },
        {
          emoji: '🌍', title: 'Share Safely', blurb: 'No personal details',
          goal: 'Share the plugin without sharing anything private.',
          list: [
            'Share only the plugin file or folder.',
            'Never include personal details in the code or README.',
            'Ask permission from a grown-up before posting online.'
          ],
          fill: { sentence: 'Never share [personal|8] details when you post a mod online.' },
          quiz: { q: 'What must never go into a shared mod?', opts: ['The plugin code', 'Personal details like your address or passwords', 'A friendly message'], correct: 1 }
        },
        {
          emoji: '🏆', title: 'Claim Your Badge', blurb: 'You finished the series',
          goal: 'Look back at everything you can do now.',
          list: [
            'You can install OpenRCT2 and find the plugin folder.',
            'You can write plugins that react to the park.',
            'You can read and change guests, and rescue them from water.',
            'You can debug, package and share your work.'
          ],
          fill: { sentence: 'You are now a Coaster [Marshal|7].' },
          quiz: { q: 'What can you do now that you could not before?', opts: ['Write, debug and share OpenRCT2 plugins', 'Fly a real coaster', 'Nothing'], correct: 0 }
        }
      ],
      finishTitle: 'Coaster Marshal!',
      finishSub: 'You built a real park tool from nothing, made it solid and shared it. That is exactly what a game modder does. Go and mod some more!',
    }
  ]
};

const MUGEN = {
  id: 'mugen-world',
  title: 'MUGEN World Workshop',
  engine: 'MUGEN',
  pillEmoji: '🥊',
  themeColor: '#d32f2f',
  css: 'style-workshop-mugen-world-workshop.css',
  hub: 'mugen-world-workshop.html',
  og: 'mugen-world-workshop',
  episodes: [
    {
      slug: 'mugen-world-ep1-setup', num: 1, level: 'Beginner',
      heroLine1: 'Enter the Arena', title: 'Episode 1: Get Set Up',
      cta: '🥊 Start Step 1',
      badge: '🥊 Episode 1 · Beginner · Setup',
      sub: 'MUGEN is a free engine for making 2D fighting games. Before you build a fighter you need the engine in the right place and you need to know your way around the folder that holds everything.',
      mins: '~40 mins',
      skills: [['📥', 'Install MUGEN'], ['📁', 'chars & stages'], ['🗂️', 'select.def'], ['🧩', 'What a character is']],
      intro: [
        { k: 'warn', icon: '🛡️', html: '<strong>Get a grown-up:</strong> downloading and unzipping the engine, and keeping your folders tidy, is a home-computer job. Do the first setup together.' },
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> MUGEN is old and simple on purpose. Everything is a folder and a text file. Learn the folder layout once and the whole engine opens up.' }
      ],
      steps: [
        {
          emoji: '📥', title: 'Get the Engine', blurb: 'Download and unzip MUGEN',
          goal: 'Have MUGEN unzipped and launching a match.',
          list: [
            'Download MUGEN from its official home and unzip it into a folder you can find. There is no installer.',
            'Open the MUGEN folder and look inside. You will see folders like <strong>chars</strong>, <strong>stages</strong>, <strong>data</strong> and <strong>sound</strong>.',
            'Run the game and start a match with the default characters to prove it works.'
          ],
          quiz: { q: 'How is MUGEN installed?', opts: ['Run a big installer', 'Unzip a folder and run it', 'Install it from an app store'], correct: 1 }
        },
        {
          emoji: '📁', title: 'Learn the Folders', blurb: 'Everything has a home',
          goal: 'Know where characters and stages live.',
          list: [
            'Characters go in <strong>chars</strong>, each in its own folder.',
            'Stages go in <strong>stages</strong>, each in its own folder.',
            'The game reads a list called <strong>select.def</strong> to know what to show on the select screen.'
          ],
          fill: { sentence: 'Characters live in the [chars|5] folder and stages live in the [stages|6] folder.' },
          quiz: { q: 'Where does a character folder go?', opts: ['chars', 'stages', 'sound'], correct: 0 }
        },
        {
          emoji: '🗂️', title: 'Meet select.def', blurb: 'The game menu list',
          goal: 'Find select.def and understand its two lists.',
          list: [
            'select.def lives in <strong>data/</strong> (or <strong>data/mugen/</strong> in newer versions).',
            'The <strong>[Characters]</strong> section lists every fighter to show.',
            'The <strong>[ExtraStages]</strong> section lists the stages.'
          ],
          fill: { sentence: 'The list of fighters is in the [Characters|10] section of select.def.' },
          quiz: { q: 'What does select.def control?', opts: ['The sound volume', 'Which fighters and stages appear in the game', 'The screen size'], correct: 1 }
        },
        {
          emoji: '🧩', title: 'What a Character Is', blurb: 'A folder of files',
          goal: 'Understand that a fighter is just files that point at each other.',
          list: [
            'A character is a folder with a <strong>.def</strong> file, plus sprites, animations, commands, states and sounds.',
            'The def file is the boss: it tells the engine where every other file is.',
            'Every fighter, from the built-in ones to the wildest fan-made ones, has this same shape.'
          ],
          fill: { sentence: 'The main file the engine reads first is the [def|3] file.' },
          quiz: { q: 'What is the main file of a character?', opts: ['The .def file', 'The .sff file', 'The .snd file'], correct: 0 }
        }
      ],
      finishTitle: 'Welcome to MUGEN!',
      finishSub: 'You have the engine running and you know the folder layout. Now you meet the files that make a fighter.',
    },
    {
      slug: 'mugen-world-ep2-fighter-files', num: 2, level: 'Beginner',
      heroLine1: 'Meet the Files', title: 'Episode 2: What Makes a Fighter',
      cta: '📄 Start Step 1',
      badge: '🥊 Episode 2 · Beginner · Files',
      sub: 'Six file types make one fighter. They sound scary until you know what each one does, and then it is just a checklist. This episode is your map of the whole character.',
      mins: '~45 mins',
      skills: [['📄', '.def'], ['🎬', '.sff'], ['🏃', '.air'], ['🎮', '.cmd'], ['🧠', '.cns'], ['🔊', '.snd']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> here is the trick: every one of these files is plain text except the two that hold art and sound. If you can open it in Notepad, you can learn it.' }
      ],
      steps: [
        {
          emoji: '📄', title: 'The def File', blurb: 'The boss file',
          goal: 'Read a def and find the [Files] list.',
          list: [
            'The def starts with <strong>[Info]</strong>: name, author and version.',
            'Then <strong>[Files]</strong> lists the other files by name: cmd, cns, sprite, anim, sound and the palette.',
            'If a name here is wrong, the engine cannot find that file. This is the number one cause of errors.'
          ],
          fill: { sentence: 'The list of files a fighter uses is in the [Files|5] section of the def.' },
          quiz: { q: 'What does the [Files] section do?', opts: ['Stores the artwork', 'Points the engine at each part by name', 'Sets the price'], correct: 1 }
        },
        {
          emoji: '🎬', title: 'Sprites (.sff)', blurb: 'The pictures',
          goal: 'Know that .sff holds the artwork.',
          list: [
            '<strong>.sff</strong> is a sprite file: every picture the fighter uses.',
            'Pictures are grouped and numbered (group, image), and the animation file calls them by those numbers.',
            'You do not have to draw from scratch: many characters start from a base sprite set.'
          ],
          quiz: { q: 'What does a .sff file hold?', opts: ['The fighter sprites', 'The commands', 'The sounds'], correct: 0 }
        },
        {
          emoji: '🏃', title: 'Animations (.air)', blurb: 'Making sprites move',
          goal: 'Know that .air turns sprites into movement.',
          list: [
            '<strong>.air</strong> holds animations. Each one lists sprite numbers and how long each is shown.',
            'An animation is named by a number that the state code calls, like anim = 200.',
            'The <strong>action number</strong> is the link between sprites and states.'
          ],
          fill: { sentence: 'Animations live in the [air|3] file and each one has an action [number|6].' },
          quiz: { q: 'How are animations identified?', opts: ['By a name', 'By a number', 'By a colour'], correct: 1 }
        },
        {
          emoji: '🎮', title: 'Commands (.cmd)', blurb: 'Turning buttons into moves',
          goal: 'Know that .cmd connects the controller to the fighter.',
          list: [
            '<strong>.cmd</strong> listens to the buttons and joystick.',
            'Each <strong>[Command]</strong> gives a name to a motion, like a quarter-circle punch.',
            'The state code then reacts to those command names.'
          ],
          quiz: { q: 'What is the .cmd file for?', opts: ['Turning controller input into named commands', 'Storing sprites', 'Playing music'], correct: 0 }
        },
        {
          emoji: '🧠', title: 'States and Sounds', blurb: '.cns and .snd',
          goal: 'Meet the last two files.',
          list: [
            '<strong>.cns</strong> holds constants and states: the fighter stats and what happens in each state.',
            '<strong>.snd</strong> holds all the sounds, called by number just like sprites.',
            'Together these six files are a complete fighter.'
          ],
          fill: { sentence: 'The fighter stats and behaviour live in the [cns|3] file.' },
          quiz: { q: 'Which two files hold the art and the sound?', opts: ['.sff and .snd', '.cmd and .cns', '.def and .air'], correct: 0 }
        }
      ],
      finishTitle: 'You Can Read a Fighter!',
      finishSub: 'Six files, one fighter, all understood. Next you will learn how the pictures and colours work.',
    },
    {
      slug: 'mugen-world-ep3-sprites-palette', num: 3, level: 'Improver',
      heroLine1: 'Colour Your Fighter', title: 'Episode 3: Sprites and Palette',
      cta: '🎨 Start Step 1',
      badge: '🥊 Episode 3 · Improver · Art',
      sub: 'Now the art. MUGEN sprites are indexed pictures: every pixel points at a colour in a palette. Change the palette and the whole fighter changes colour, with no redrawing.',
      mins: '~50 mins',
      skills: [['🎨', 'Indexed colour'], ['👥', 'Group & image'], ['🖌️', 'Palettes .act'], ['🌈', 'Recolour']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> the palette trick is why one fighter can come in ten colours. Learn it and you can make your fighter yours without drawing a single new picture.' }
      ],
      steps: [
        {
          emoji: '🎨', title: 'How Indexed Colour Works', blurb: 'Colour by number',
          goal: 'Understand that each pixel is a palette number, not a colour.',
          list: [
            'A classic MUGEN sprite uses a 256 colour palette.',
            'Each pixel stores a <strong>number</strong> from 0 to 255, not a colour.',
            'The palette file decides what colour each number actually is.'
          ],
          fill: { sentence: 'In an indexed sprite, each pixel stores a colour [number|6].' },
          quiz: { q: 'Why can you recolour a fighter without redrawing it?', opts: ['Sprites store palette numbers, so swapping the palette swaps the colours', 'MUGEN has a paint tool', 'The sprites are vectors'], correct: 0 }
        },
        {
          emoji: '👥', title: 'Group and Image', blurb: 'Finding the right sprite',
          goal: 'Understand the (group, image) address.',
          list: [
            'Every sprite has a <strong>group</strong> and an <strong>image</strong> number.',
            'An animation points at sprites like <strong>0,1</strong> meaning group 0, image 1.',
            'Group the sprites so related pictures sit together (all walk frames in one group).'
          ],
          fill: { sentence: 'A sprite is found by its group and [image|5] numbers.' },
          quiz: { q: 'What points an animation at a sprite?', opts: ['The group and image numbers', 'The file name', 'The sound number'], correct: 0 }
        },
        {
          emoji: '🖌️', title: 'The Palette File (.act)', blurb: 'One file, all the colour',
          goal: 'Know that .act holds the palette.',
          list: [
            '<strong>.act</strong> is a palette file: 256 colours in order.',
            'The def lists palettes as pal1, pal2 and so on, giving a colour choice on the select screen.',
            'Editing an .act is the easiest way to make a character your own.'
          ],
          quiz: { q: 'What is an .act file?', opts: ['A palette of 256 colours', 'An animation', 'A sound'], correct: 0 }
        },
        {
          emoji: '🌈', title: 'Make a New Colour', blurb: 'Swap the palette',
          goal: 'Give your fighter a second palette.',
          list: [
            'Open a palette editor and load the fighter palette.',
            'Change a few colours (the clothing, the trim) and save as a new .act.',
            'List it in the def as pal2 and pick it on the select screen.'
          ],
          fill: { sentence: 'Extra palettes are listed in the def as pal2, [pal3|5] and so on.' },
          quiz: { q: 'Where do you list extra palettes?', opts: ['In the def file', 'In the .sff', 'In the sound file'], correct: 0 }
        }
      ],
      finishTitle: 'Your Fighter, Your Colours!',
      finishSub: 'You understand indexed colour and you can recolour any fighter. Next: make them move.',
    },
    {
      slug: 'mugen-world-ep4-animations', num: 4, level: 'Improver',
      heroLine1: 'Make Them Move', title: 'Episode 4: Animations',
      cta: '🏃 Start Step 1',
      badge: '🥊 Episode 4 · Improver · Animation',
      sub: 'An animation is a list of sprites shown in order. In this episode you read and write .air animations, learn about timing, and understand the action number that states call.',
      mins: '~50 mins',
      skills: [['🎞️', 'Action blocks'], ['⏱️', 'Timing'], ['🔁', 'Loops'], ['🎯', 'Action numbers']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> animation code is just lines of "show this picture, for this many frames". Once you see that, the .air file becomes readable.' }
      ],
      steps: [
        {
          emoji: '🎞️', title: 'One Action Block', blurb: 'The shape of an animation',
          goal: 'Read a [Begin Action] block.',
          list: [
            'Each animation starts with <strong>[Begin Action N]</strong> where N is the action number.',
            'Then one line per frame: <strong>group, image, x offset, y offset, ticks</strong>.',
            'Ticks is how long the picture stays on screen.'
          ],
          code: '[Begin Action 0]\n0,0, 0,0, 8\n0,1, 0,0, 8\n0,2, 0,0, 8',
          fill: { sentence: 'Each animation block starts with [Begin|5] Action and a number.' },
          quiz: { q: 'What is the last number on an animation line?', opts: ['How long the frame shows', 'The sound number', 'The damage'], correct: 0 }
        },
        {
          emoji: '⏱️', title: 'Timing and Feel', blurb: 'Slow and punchy',
          goal: 'Adjust timing to change how a move feels.',
          list: [
            'Bigger tick numbers make a move feel slow and heavy.',
            'Small tick numbers make it snappy.',
            'A punch should snap out fast and hold a moment on the hit frame.'
          ],
          fill: { sentence: 'A snappy move uses [small|5] tick numbers.' },
          quiz: { q: 'A punch should feel fast. What timing helps?', opts: ['Small ticks out, a longer hold on the hit', 'Very large ticks everywhere', 'Zero ticks'], correct: 0 }
        },
        {
          emoji: '🔁', title: 'Loops and Idle', blurb: 'Breathing in place',
          goal: 'Make a looping idle animation.',
          list: [
            'An idle animation loops: the engine shows the action again and again.',
            'Keep the first and last sprite similar so the loop does not jump.',
            'A gentle idle makes a fighter feel alive.'
          ],
          fill: { sentence: 'The idle animation should [loop|4] so the fighter keeps breathing.' },
          quiz: { q: 'Why keep the first and last idle sprite similar?', opts: ['So the loop does not jump', 'To save memory', 'It is a rule'], correct: 0 }
        },
        {
          emoji: '🎯', title: 'Action Numbers', blurb: 'The link to states',
          goal: 'Understand how states call animations.',
          list: [
            'A state says anim = 200 to play action 200.',
            'Keep a list of your action numbers so you can find them.',
            'Common actions: 0 standing, 20 walking, 200 a punch, 5000 getting hit.'
          ],
          fill: { sentence: 'A state plays an animation with anim = [200|4] (or whichever number you chose).' },
          quiz: { q: 'How does a state know which animation to play?', opts: ['By the action number', 'By the file name', 'It guesses'], correct: 0 }
        }
      ],
      finishTitle: 'Your Fighter Moves!',
      finishSub: 'You can read and write animations. Next you connect the controller to those animations with commands.',
    },
    {
      slug: 'mugen-world-ep5-commands', num: 5, level: 'Improver',
      heroLine1: 'Press the Right Buttons', title: 'Episode 5: Commands',
      cta: '🎮 Start Step 1',
      badge: '🥊 Episode 5 · Improver · Controls',
      sub: 'Commands are how a motion like a quarter-circle punch becomes a named thing your code can react to. This episode turns button presses into moves.',
      mins: '~50 mins',
      skills: [['🎮', '[Command]'], ['🕹️', 'Motions'], ['⏱️', 'Buffers'], ['🧠', 'React in code']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> commands are just patterns in time. Forward, down, down-forward plus punch becomes one name, and your state code watches for that name.' }
      ],
      steps: [
        {
          emoji: '🎮', title: 'A Simple Command', blurb: 'Name a button',
          goal: 'Write a command for a single button.',
          list: [
            'Each command has a <strong>name</strong>, a <strong>command</strong> pattern and a <strong>time</strong>.',
            'A single button is just its letter, like <strong>x</strong>.',
            'The name is what your state code listens for.'
          ],
          code: '[Command]\nname = "x"\ncommand = x\ntime = 1',
          fill: { sentence: 'A command gives a [name|4] to a button press.' },
          quiz: { q: 'What does the name in a command do?', opts: ['Lets your state code react to it', 'Sets the damage', 'Draws the button'], correct: 0 }
        },
        {
          emoji: '🕹️', title: 'Motions', blurb: 'Quarter circles and holds',
          goal: 'Write a quarter-circle motion.',
          list: [
            'Directions use symbols: <strong>F</strong> forward, <strong>B</strong> back, <strong>D</strong> down, <strong>U</strong> up.',
            'A quarter circle forward is down, down-forward, forward: <strong>D, DF, F</strong>, then a button.',
            'Holding is written with a slash, like <strong>/$D</strong> for holding down.'
          ],
          code: '[Command]\nname = "QCF_x"\ncommand = D, DF, F, x\ntime = 15',
          fill: { sentence: 'A quarter circle forward is D, DF, [F|1] then a button.' },
          quiz: { q: 'What does the time value allow?', opts: ['How long you have to do the motion', 'The damage', 'The sprite'], correct: 0 }
        },
        {
          emoji: '⏱️', title: 'Buffer and Feel', blurb: 'Forgiving inputs',
          goal: 'Understand command buffering.',
          list: [
            'command.time is how long the engine waits for the full motion.',
            'command.buffer.time lets a press just before you land still count.',
            'Too tight is frustrating, too loose makes moves fire by accident.'
          ],
          fill: { sentence: 'command.[buffer|6].time makes inputs more forgiving.' },
          quiz: { q: 'Why have a command buffer?', opts: ['So a press just before landing still counts', 'To slow the game', 'To hide inputs'], correct: 0 }
        },
        {
          emoji: '🧠', title: 'React in Code', blurb: 'Connect commands to states',
          goal: 'Trigger a state when a command fires.',
          list: [
            'In the state file you use a trigger like <strong>command = "QCF_x"</strong>.',
            'When it fires, a <strong>ChangeState</strong> controller switches the fighter to the punch state.',
            'Command in .cmd, reaction in .cns. Two files, one move.'
          ],
          fill: { sentence: 'A controller called [ChangeState|11] switches the fighter to a new state.' },
          quiz: { q: 'Which file reacts to a command?', opts: ['The state file (.cns)', 'The sprite file', 'The sound file'], correct: 0 }
        }
      ],
      finishTitle: 'Moves on Command!',
      finishSub: 'Button presses are now named commands you can code against. Next you write the states those commands trigger.',
    },
    {
      slug: 'mugen-world-ep6-states', num: 6, level: 'Advanced',
      heroLine1: 'Write the Rules', title: 'Episode 6: States and Constants',
      cta: '🧠 Start Step 1',
      badge: '🥊 Episode 6 · Advanced · States',
      sub: 'States are the heart of a fighter: what it does, when input is allowed, and what happens on a hit. This is the biggest idea in MUGEN, so we take it slowly.',
      mins: '~1 hour',
      skills: [['🧠', 'Statedef'], ['🎛️', 'Controllers'], ['📊', 'Constants'], ['🔗', 'Changes']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> a mind is just rules. A state says "when you are in this situation, do these things". Stack enough rules and your fighter feels alive.' }
      ],
      steps: [
        {
          emoji: '🧠', title: 'A State Block', blurb: 'The situation',
          goal: 'Read a [Statedef] block.',
          list: [
            'A state starts with <strong>[Statedef N]</strong>, where N is the state number.',
            'It sets things like <strong>type</strong> (stand/crouch/air), <strong>movetype</strong> (idle/attack), <strong>physics</strong> and which <strong>anim</strong> to play.',
            '<strong>ctrl = 1</strong> means the player can still control the fighter.'
          ],
          code: '[Statedef 200]\ntype = S\nmovetype = A\nphysics = S\nanim = 200\nctrl = 0',
          fill: { sentence: 'A state begins with [Statedef|8] and a number.' },
          quiz: { q: 'What does ctrl = 1 mean in a state?', opts: ['The player can control the fighter', 'The fighter is frozen', 'The state is deleted'], correct: 0 }
        },
        {
          emoji: '🎛️', title: 'Controllers', blurb: 'The instructions',
          goal: 'Understand a controller inside a state.',
          list: [
            'Inside a state, each <strong>[State ...]</strong> block is a controller: one instruction.',
            'Controllers have a <strong>type</strong> (like VelSet, ChangeState, PlaySnd) and <strong>trigger</strong> lines.',
            'The controller only runs when its triggers are true.'
          ],
          fill: { sentence: 'Each instruction inside a state is called a [controller|10].' },
          quiz: { q: 'When does a controller run?', opts: ['When its triggers are true', 'Every frame always', 'Never'], correct: 0 }
        },
        {
          emoji: '📊', title: 'Constants', blurb: 'The fighter statistics',
          goal: 'Read the [Data] and [Size] constants.',
          list: [
            '<strong>[Data]</strong> sets life, attack and defence.',
            '<strong>[Size]</strong> sets the fighter hitbox sizes and shadow.',
            '<strong>[Velocity]</strong> sets walk and run speeds.'
          ],
          fill: { sentence: 'The fighter life, attack and defence live in the [Data|4] constants.' },
          quiz: { q: 'Where do you set how much life a fighter has?', opts: ['[Data] constants', 'The .snd file', 'select.def'], correct: 0 }
        },
        {
          emoji: '🔗', title: 'Moving Between States', blurb: 'ChangeState',
          goal: 'Send the fighter from one state to another.',
          list: [
            '<strong>ChangeState</strong> with a value moves the fighter to a new state number.',
            'A punch state ends by changing back to the idle state.',
            'This is how a whole fighting game chains together.'
          ],
          fill: { sentence: 'To leave a state, use a ChangeState [controller|10].' },
          quiz: { q: 'How does a punch state return to idle?', opts: ['It changes state back to idle at the end', 'It restarts the game', 'It cannot'], correct: 0 }
        },
        {
          emoji: '🧪', title: 'Test One Move', blurb: 'Make a punch land',
          goal: 'Wire one move end to end and test it.',
          list: [
            'Command fires, state triggers, animation plays, controller returns to idle.',
            'Test in a match and watch the move happen.',
            'If nothing happens, check the command name matches the state trigger exactly.'
          ],
          fill: { sentence: 'If a move does nothing, check the command and trigger [names|5] match exactly.' },
          quiz: { q: 'A move does nothing. First thing to check?', opts: ['The command name matches the state trigger', 'The music', 'The window size'], correct: 0 }
        }
      ],
      finishTitle: 'Your Fighter Has Rules!',
      finishSub: 'You can write states and constants and chain moves. Next you make attacks actually connect with hitboxes.',
    },
    {
      slug: 'mugen-world-ep7-hitboxes', num: 7, level: 'Advanced',
      heroLine1: 'Land the Hit', title: 'Episode 7: Hitboxes',
      cta: '🎯 Start Step 1',
      badge: '🥊 Episode 7 · Advanced · Hitboxes',
      sub: 'A move only counts when one fighter hitbox touches another. This episode explains Clsn1 and Clsn2, and why a move that looks right can still miss.',
      mins: '~50 mins',
      skills: [['🔴', 'Clsn1 attack'], ['🔵', 'Clsn2 hurt'], ['📦', 'Boxes'], ['🧪', 'Test a hit']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> the engine does not care what a move looks like. It cares where the invisible boxes are. Draw the boxes well and the game feels fair.' }
      ],
      steps: [
        {
          emoji: '🔴', title: 'The Attack Box (Clsn1)', blurb: 'Where you can hit',
          goal: 'Understand Clsn1.',
          list: [
            '<strong>Clsn1</strong> is the attack box, usually drawn red in debug mode.',
            'It only exists on the frames where the move can hit.',
            'No Clsn1, no hit, no matter how good the animation looks.'
          ],
          fill: { sentence: 'The attack box is called [Clsn1|5].' },
          quiz: { q: 'What happens with no Clsn1 on a frame?', opts: ['The move cannot hit on that frame', 'The game crashes', 'The move does double damage'], correct: 0 }
        },
        {
          emoji: '🔵', title: 'The Hurt Box (Clsn2)', blurb: 'Where you can be hit',
          goal: 'Understand Clsn2.',
          list: [
            '<strong>Clsn2</strong> is the hurt box, usually blue: where the fighter can be hit.',
            'It is on nearly every frame, including idle.',
            'A hit happens when one fighter Clsn1 overlaps the other fighter Clsn2.'
          ],
          fill: { sentence: 'The hurt box is called [Clsn2|5].' },
          quiz: { q: 'A hit happens when which two boxes overlap?', opts: ['Attacker Clsn1 and defender Clsn2', 'Two Clsn2 boxes', 'Two Clsn1 boxes'], correct: 0 }
        },
        {
          emoji: '📦', title: 'Drawing the Boxes', blurb: 'Rectangles in the .air',
          goal: 'Know where hitboxes are written.',
          list: [
            'Boxes are written in the <strong>.air</strong> file, near each animation.',
            'Each box is a rectangle: left, top, right, bottom.',
            '<strong>Clsn2Default</strong> sets the hurt box for every frame, so you do not repeat it.'
          ],
          code: '[Begin Action 200]\nClsn2Default: 1\n Clsn2[0] = -20,-90, 20,-1\nClsn1: 1\n Clsn1[0] = 20,-70, 55,-40\n200,0, 0,0, 4',
          fill: { sentence: 'Hitboxes are written in the [air|3] file.' },
          quiz: { q: 'Where are hitboxes written?', opts: ['In the .air animation file', 'In the .snd', 'In select.def'], correct: 0 }
        },
        {
          emoji: '🧪', title: 'Test and Tune', blurb: 'See the boxes',
          goal: 'Turn on debug boxes and fix a move that misses.',
          list: [
            'Turn on the debug display to see the boxes while you play.',
            'If a punch looks like it hits but does not, the Clsn1 is too short.',
            'If moves hit from too far, the Clsn1 is too long. Tune it until it feels fair.'
          ],
          fill: { sentence: 'If a punch looks right but misses, the [Clsn1|5] is probably too short.' },
          quiz: { q: 'A move hits from too far away. What do you change?', opts: ['Shorten the Clsn1 box', 'Delete the animation', 'Add more damage'], correct: 0 }
        }
      ],
      finishTitle: 'Hits That Feel Fair!',
      finishSub: 'You understand hitboxes and how to tune them. Next you give your fighter a proper stage.',
    },
    {
      slug: 'mugen-world-ep8-stage', num: 8, level: 'Improver',
      heroLine1: 'Build the Arena', title: 'Episode 8: Make a Stage',
      cta: '🏙️ Start Step 1',
      badge: '🥊 Episode 8 · Improver · Stages',
      sub: 'A stage is three things: a floor, a camera and a background. Build your own arena and your fighter finally has a home.',
      mins: '~50 mins',
      skills: [['🏙️', 'Stage def'], ['📷', 'Camera'], ['🎨', 'Background'], ['🎵', 'Music']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> start by copying a stage that works, change its picture, then move the camera. Copy, change, test. Same loop every time.' }
      ],
      steps: [
        {
          emoji: '🏙️', title: 'The Stage def', blurb: 'Three sections',
          goal: 'Read a stage def.',
          list: [
            '<strong>[Info]</strong> names the stage and the author.',
            '<strong>[Camera]</strong> and <strong>[StageInfo]</strong> control the view and the floor height (zoffset).',
            '<strong>[BGdef]</strong> points at the background sprite file.'
          ],
          fill: { sentence: 'The floor height of a stage is set with [zoffset|7].' },
          quiz: { q: 'Which section sets the floor height?', opts: ['[StageInfo], via zoffset', '[Info]', '[Music]'], correct: 0 }
        },
        {
          emoji: '📷', title: 'The Camera', blurb: 'How far you can walk',
          goal: 'Set the camera bounds.',
          list: [
            '<strong>boundleft</strong> and <strong>boundright</strong> limit how far the fighters can spread.',
            'A wide stage needs a wide background so you never see the edge.',
            'Start close and widen once it looks right.'
          ],
          fill: { sentence: 'The camera limits are called boundleft and [boundright|10].' },
          quiz: { q: 'What do boundleft and boundright do?', opts: ['Limit how far fighters can spread', 'Set the music', 'Change the floor colour'], correct: 0 }
        },
        {
          emoji: '🎨', title: 'The Background', blurb: 'Paint the place',
          goal: 'Give the stage its own picture.',
          list: [
            'The background is a sprite in the stage .sff, pointed at by spr in [BGdef].',
            'A single big picture is the simplest start.',
            'Later you can add parallax layers that move at different speeds.'
          ],
          fill: { sentence: 'The background sprite is pointed at by spr in the [BGdef|6] section.' },
          quiz: { q: 'What does the spr line point to?', opts: ['The background sprite file', 'The music file', 'The select screen'], correct: 0 }
        },
        {
          emoji: '🎵', title: 'Add Music', blurb: 'Set the mood',
          goal: 'Give the stage its own track.',
          list: [
            'The <strong>[Music]</strong> section sets the background tune.',
            'Keep the file small so it loads quickly.',
            'A stage with the right music feels ten times better.'
          ],
          fill: { sentence: 'The stage tune is set in the [Music|5] section.' },
          quiz: { q: 'Which section sets the background music?', opts: ['[Music]', '[StageInfo]', '[Camera]'], correct: 0 }
        },
        {
          emoji: '🧪', title: 'Fight On It', blurb: 'Play-test the stage',
          goal: 'Run a match on your stage and fix anything odd.',
          list: [
            'Check the fighters do not float or sink: adjust zoffset.',
            'Check you never see past the background: widen it or tighten bounds.',
            'Then register the stage in select.def so it shows up.'
          ],
          fill: { sentence: 'Fighters floating or sinking means the [zoffset|7] is wrong.' },
          quiz: { q: 'Fighters look like they float. What do you adjust?', opts: ['zoffset', 'The music', 'The palette'], correct: 0 }
        }
      ],
      finishTitle: 'A Stage of Your Own!',
      finishSub: 'You built an arena. Next you teach a computer to play your fighter.',
    },
    {
      slug: 'mugen-world-ep9-ai', num: 9, level: 'Advanced',
      heroLine1: 'Teach It to Think', title: 'Episode 9: AI',
      cta: '🤖 Start Step 1',
      badge: '🥊 Episode 9 · Advanced · AI',
      sub: 'A fighter with no brain just stands there. The AI is a set of rules that decides when to attack, block and back off. Make it beatable but not boring.',
      mins: '~1 hour',
      skills: [['🤖', 'AI rules'], ['📏', 'Distance'], ['🛡️', 'Blocking'], ['⚖️', 'Difficulty']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> good AI is good rules, not magic. Decide what the fighter should do at close, mid and far range, and you are most of the way there.' }
      ],
      steps: [
        {
          emoji: '🤖', title: 'How MUGEN AI Works', blurb: 'Special commands',
          goal: 'Understand that AI is your own code deciding.',
          list: [
            'When the computer controls a fighter, the engine lets your commands fire by themselves.',
            'You write AI rules that use the same commands a player would.',
            'The <strong>AILevel</strong> value tells you how hard the CPU is set to play.'
          ],
          fill: { sentence: 'The difficulty of the CPU is read from [AILevel|7].' },
          quiz: { q: 'What does MUGEN AI actually use?', opts: ['The same commands a player uses, fired by your rules', 'A hidden neural network', 'The internet'], correct: 0 }
        },
        {
          emoji: '📏', title: 'React to Distance', blurb: 'Close, mid, far',
          goal: 'Decide behaviour by how far the enemy is.',
          list: [
            'Find the distance between the fighters each moment.',
            'Far: walk forward. Mid: approach or poke. Close: attack or block.',
            'Three ranges make an AI that reads well.'
          ],
          fill: { sentence: 'A simple AI thinks in three ranges: far, mid and [close|5].' },
          quiz: { q: 'A simple, readable AI divides the fight into how many ranges?', opts: ['Three', 'Twenty', 'None'], correct: 0 }
        },
        {
          emoji: '🛡️', title: 'Block and Punish', blurb: 'Not just attacking',
          goal: 'Make the AI block sometimes.',
          list: [
            'An AI that only attacks is easy to beat.',
            'Block when the enemy is attacking, then attack back when they stop.',
            'A little randomness makes it feel alive, not robotic.'
          ],
          fill: { sentence: 'An AI should [block|5] as well as attack.' },
          quiz: { q: 'Why should an AI sometimes block?', opts: ['An AI that only attacks is too easy to beat', 'Blocking looks nice', 'It is required'], correct: 0 }
        },
        {
          emoji: '⚖️', title: 'Balance the Difficulty', blurb: 'Fun, not unfair',
          goal: 'Tune the AI so it is beatable.',
          list: [
            'A perfect AI is no fun. Leave gaps.',
            'Use AILevel so a hard setting acts more often than an easy one.',
            'Play against it five times and see if you ever lose. Adjust.'
          ],
          fill: { sentence: 'A perfect AI that never misses is [no|2] fun to fight.' },
          quiz: { q: 'What is the goal of AI difficulty?', opts: ['Beatable but interesting', 'Impossible to beat', 'Never attack'], correct: 0 }
        }
      ],
      finishTitle: 'Your Fighter Thinks!',
      finishSub: 'The CPU can now fight. The last step is to put everything together into a complete game.',
    },
    {
      slug: 'mugen-world-ep10-game', num: 10, level: 'Capstone',
      heroLine1: 'Assemble the Game', title: 'Episode 10: Build the Whole Game',
      cta: '🕹️ Start Step 1',
      badge: '🥊 Episode 10 · Capstone · Full Game',
      sub: 'You have a fighter, a stage and an AI. Now you put them into the select screen, choose your roster and stages, and get a full game you can share.',
      mins: '~1 hour',
      skills: [['🕹️', 'select.def'], ['🗂️', 'Roster'], ['🖼️', 'Screenpack'], ['🌍', 'Share']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> this is the satisfying part. Your fighter joins the roster, your stage is in the rotation, and the game is yours. Then you share it, safely.' }
      ],
      steps: [
        {
          emoji: '🗂️', title: 'Build Your Roster', blurb: 'Who is in the game',
          goal: 'Add your fighter and others to the select screen.',
          list: [
            'Open <strong>select.def</strong> and add your character folder name under <strong>[Characters]</strong>.',
            'Add any other fighters you want in the roster.',
            'Some versions let you set a random select and hidden characters.'
          ],
          fill: { sentence: 'You add fighters under the [Characters|10] section of select.def.' },
          quiz: { q: 'Where do you list the fighters for the select screen?', opts: ['select.def [Characters]', 'The .sff', 'The stage def'], correct: 0 }
        },
        {
          emoji: '🕹️', title: 'Add Your Stages', blurb: 'Where you fight',
          goal: 'Put your stage in the rotation.',
          list: [
            'Stages go in the <strong>[ExtraStages]</strong> section of select.def.',
            'You can put a stage under a character so they always fight there.',
            'Order the list so the good stages come up often.'
          ],
          fill: { sentence: 'Extra stages are listed under [ExtraStages|12] in select.def.' },
          quiz: { q: 'How do you add a stage to the game?', opts: ['List it in [ExtraStages] in select.def', 'Put it in the chars folder', 'Name it music.mp3'], correct: 0 }
        },
        {
          emoji: '🖼️', title: 'The Screenpack', blurb: 'How the game looks',
          goal: 'Understand what a screenpack changes.',
          list: [
            'A <strong>screenpack</strong> changes the title screen, the select screen layout and the fonts.',
            'It is optional: the default pack already works.',
            'Changing the pack is how you give a MUGEN game its own identity.'
          ],
          fill: { sentence: 'The look of the menus is set by the [screenpack|10].' },
          quiz: { q: 'What does a screenpack change?', opts: ['The menus and select screen look', 'The fighter damage', 'The palette'], correct: 0 }
        },
        {
          emoji: '🧪', title: 'Final Play-Test', blurb: 'Break it before players do',
          goal: 'Play a full arcade run and fix what breaks.',
          list: [
            'Fight through a whole arcade run with each character.',
            'Watch for crashes, missing sprites and stuck states.',
            'Fix the first problem you find, then test again.'
          ],
          fill: { sentence: 'Fix the [first|5] problem you find, then test again.' },
          quiz: { q: 'What is a good final test?', opts: ['A full arcade run with each character', 'Opening and closing the game', 'Reading the files'], correct: 0 }
        },
        {
          emoji: '🌍', title: 'Share It Safely', blurb: 'Pass it on',
          goal: 'Share your game without sharing private details.',
          list: [
            'Zip your MUGEN folder (or just the chars, stages and select.def) to share it.',
            'Give credit to any sprites or characters you did not make yourself.',
            'Never include personal details, and ask a grown-up before posting online.'
          ],
          fill: { sentence: 'Always give [credit|6] for art or characters you did not make.' },
          quiz: { q: 'What must you do when sharing a mod that uses other people art?', opts: ['Give credit to the original makers', 'Rename it', 'Nothing'], correct: 0 }
        }
      ],
      finishTitle: 'You Made a Fighting Game!',
      finishSub: 'A fighter, a stage, an AI and a full game, all yours. That is the whole MUGEN project, start to finish. Go and make another one!',
    }
  ]
};

const MINECRAFT = {
  id: 'minecraft-world',
  title: 'Minecraft World Workshop',
  engine: 'Minecraft',
  pillEmoji: '⛏️',
  themeColor: '#4f8a2c',
  css: 'style-workshop-minecraft-world-workshop.css',
  hub: 'minecraft-world-workshop.html',
  og: 'minecraft-world-workshop',
  episodes: [
    {
      slug: 'minecraft-world-ep1-setup', num: 1, level: 'Beginner',
      heroLine1: 'Open the Data Folder', title: 'Episode 1: What a Datapack Is',
      cta: '⛏️ Start Step 1',
      badge: '⛏️ Episode 1 · Beginner · Setup',
      sub: 'A datapack is the friendliest Minecraft mod of all: just a folder of text files, no mod loader and no install. In this episode you make one, load it and see it work.',
      mins: '~40 mins',
      skills: [['📁', 'Datapack folder'], ['📄', 'pack.mcmeta'], ['♻️', '/reload'], ['✅', 'Load check']],
      intro: [
        { k: 'warn', icon: '🛡️', html: '<strong>No install needed:</strong> datapacks work in normal Minecraft Java Edition. You do need the Java Edition game (not Bedrock) to follow along.' },
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> no compiler, no mod loader, no admin rights. A datapack is a folder you drop into a world. This is the best first mod in any game.' }
      ],
      steps: [
        {
          emoji: '📦', title: 'What a Datapack Is', blurb: 'A folder Minecraft reads',
          goal: 'Understand what a datapack is and where it lives.',
          list: [
            'A datapack is a folder of text files that changes Minecraft using the game own systems.',
            'It lives in a world folder at <strong>saves/&lt;your world&gt;/datapacks/</strong>.',
            'You never touch the game own files, so a datapack is safe and easy to remove.'
          ],
          fill: { sentence: 'A datapack goes in a world at saves/&lt;world&gt;/[datapacks|10]/.' },
          quiz: { q: 'Where does a datapack go?', opts: ['saves/<world>/datapacks/', 'The .minecraft/mods folder', 'The game install folder'], correct: 0 }
        },
        {
          emoji: '📄', title: 'Make pack.mcmeta', blurb: 'The file that says "I am a datapack"',
          goal: 'Create a datapack the game accepts.',
          list: [
            'Make a folder for your pack inside datapacks.',
            'Inside it, create a file called <strong>pack.mcmeta</strong>.',
            'It needs a <strong>pack_format</strong> number matching your Minecraft version, and a description.'
          ],
          code: '{\n  "pack": {\n    "pack_format": 48,\n    "description": "My First Datapack"\n  }\n}',
          fill: { sentence: 'The file that marks a folder as a datapack is pack.[mcmeta|6].' },
          quiz: { q: 'What does pack.mcmeta do?', opts: ['Tells Minecraft this folder is a datapack and which version it is for', 'Stores your items', 'Plays a sound'], correct: 0 }
        },
        {
          emoji: '♻️', title: 'Load It', blurb: '/reload and /datapack list',
          goal: 'See your pack loaded in the game.',
          list: [
            'Open your world and type <strong>/reload</strong> to load datapacks.',
            'Type <strong>/datapack list</strong> and find your pack in the list.',
            'If it is not there, check the folder is unzipped and holds pack.mcmeta at its top level.'
          ],
          fill: { sentence: 'To load datapacks without restarting, type /[reload|6].' },
          quiz: { q: 'Your pack is not listed. Most likely cause?', opts: ['The folder is not in datapacks, or pack.mcmeta is not at its top level', 'Your PC is slow', 'You need a mod loader'], correct: 0 }
        },
        {
          emoji: '✅', title: 'Ready Check', blurb: 'The four things you now have',
          goal: 'Confirm your setup before writing content.',
          list: [
            'Minecraft Java Edition running.',
            'A world you can open.',
            'A datapack folder with a valid pack.mcmeta.',
            'The pack shows in /datapack list.'
          ],
          fill: { sentence: 'A datapack needs no [install|7] and no mod loader.' },
          quiz: { q: 'What is the best thing about a datapack?', opts: ['No install, no mod loader, easy to remove', 'It costs money', 'It needs admin rights'], correct: 0 }
        }
      ],
      finishTitle: 'Your Datapack Is Live!',
      finishSub: 'You made a datapack and the game loaded it. Now let us add something real: a crafting recipe.',
    },
    {
      slug: 'minecraft-world-ep2-first-recipe', num: 2, level: 'Beginner',
      heroLine1: 'Craft Something New', title: 'Episode 2: Your First Recipe',
      cta: '🧪 Start Step 1',
      badge: '⛏️ Episode 2 · Beginner · Recipes',
      sub: 'A recipe is one JSON file that tells Minecraft what items combine into what. In this episode you write your first recipe and craft it in-game.',
      mins: '~45 mins',
      skills: [['📜', 'Recipe JSON'], ['🧩', 'pattern & key'], ['🎁', 'result'], ['🧪', 'Craft it']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> a recipe is a small JSON file. Three parts: the type, the shape, and the result. Learn those three and you can make anything craftable.' }
      ],
      steps: [
        {
          emoji: '📜', title: 'The Recipe File', blurb: 'Where recipes live',
          goal: 'Put a recipe file in the right place.',
          list: [
            'Recipes go in <strong>data/&lt;namespace&gt;/recipe/</strong> (singular recipe in 1.21 and newer).',
            'The namespace is a name you choose for your pack, lowercase like <strong>mypack</strong>.',
            'Each recipe is one .json file.'
          ],
          fill: { sentence: 'In 1.21+, recipes go in data/&lt;namespace&gt;/[recipe|6]/ (singular).' },
          quiz: { q: 'In 1.21 and newer, what is the recipe folder called?', opts: ['recipe (singular)', 'recipes (plural)', 'crafting'], correct: 0 }
        },
        {
          emoji: '🧩', title: 'Shape and Key', blurb: 'The pattern of a recipe',
          goal: 'Write a shaped recipe.',
          list: [
            '<strong>pattern</strong> is the shape on the 3x3 grid, one string per row.',
            '<strong>key</strong> says what each letter means.',
            'A space in the pattern means an empty slot.'
          ],
          code: '{\n  "type": "minecraft:crafting_shaped",\n  "pattern": ["PPP", " S ", " S "],\n  "key": {\n    "P": { "item": "minecraft:oak_planks" },\n    "S": { "item": "minecraft:stick" }\n  },\n  "result": { "item": "minecraft:wooden_sword", "count": 1 }\n}',
          fill: { sentence: 'The [pattern|7] shows the shape, and the key says what each letter means.' },
          quiz: { q: 'What does a space in the pattern mean?', opts: ['An empty slot', 'A diamond', 'A random item'], correct: 0 }
        },
        {
          emoji: '🎁', title: 'The Result', blurb: 'What comes out',
          goal: 'Set what the recipe makes.',
          list: [
            '<strong>result</strong> is the item you get, using the full id like minecraft:torch.',
            'You can set a <strong>count</strong> for how many come out.',
            'Item ids must match the game exactly, including the minecraft: part.'
          ],
          fill: { sentence: 'An item id needs its full name, like [minecraft|9]:diamond.' },
          quiz: { q: 'What is a valid item id?', opts: ['minecraft:diamond', 'diamond', 'DiamondItem'], correct: 0 }
        },
        {
          emoji: '🧪', title: 'Craft It', blurb: 'See it in the table',
          goal: 'Load your recipe and craft it.',
          list: [
            'Type /reload, then open a crafting table.',
            'Lay out the ingredients exactly like your pattern.',
            'Your recipe should appear. If not, check the folder name and the JSON commas.'
          ],
          fill: { sentence: 'After adding a recipe, type /[reload|6] to load it.' },
          quiz: { q: 'Your recipe does not appear. First thing to check?', opts: ['The folder path and the JSON commas', 'The weather', 'Your inventory'], correct: 0 }
        }
      ],
      finishTitle: 'You Made a Recipe!',
      finishSub: 'You can make Minecraft craftable things. Next you learn how the data folder and namespaces keep everything tidy.',
    },
    {
      slug: 'minecraft-world-ep3-namespace', num: 3, level: 'Beginner',
      heroLine1: 'Get Organised', title: 'Episode 3: The data Folder',
      cta: '🗂️ Start Step 1',
      badge: '⛏️ Episode 3 · Beginner · Structure',
      sub: 'As your datapack grows, the data folder is what keeps it tidy. Learn namespaces and the folder for each thing a datapack can do.',
      mins: '~40 mins',
      skills: [['🗂️', 'data folder'], ['🏷️', 'Namespace'], ['📚', 'Folder types'], ['🧭', 'Ids']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> a tidy pack is a happy pack. Namespaces are just folders with a name you choose, so two packs never clash.' }
      ],
      steps: [
        {
          emoji: '🗂️', title: 'The data Folder', blurb: 'Where everything lives',
          goal: 'Understand the data/&lt;namespace&gt;/ layout.',
          list: [
            'All your content lives inside <strong>data/</strong>.',
            'Inside data, a <strong>namespace</strong> folder holds your stuff.',
            'Inside the namespace, each kind of content has its own folder: recipe, function, loot_table, advancement and so on.'
          ],
          fill: { sentence: 'Your content lives inside the [data|4] folder, under your namespace.' },
          quiz: { q: 'What is a namespace?', opts: ['A folder name you choose so packs do not clash', 'A type of block', 'A game setting'], correct: 0 }
        },
        {
          emoji: '🏷️', title: 'Choose a Namespace', blurb: 'Your pack name',
          goal: 'Pick and use a namespace.',
          list: [
            'Use lowercase letters, numbers and underscores: <strong>mypack</strong> or <strong>emerald_quest</strong>.',
            'Never use spaces or capitals.',
            'Every id you make is prefixed with it, like mypack:diamond_blade.'
          ],
          fill: { sentence: 'A namespace uses lowercase letters, numbers and [underscores|11].' },
          quiz: { q: 'Which is a valid namespace?', opts: ['emerald_quest', 'Emerald Quest', 'emerald-quest!'], correct: 0 }
        },
        {
          emoji: '📚', title: 'The Folder Types', blurb: 'A home for each thing',
          goal: 'Know the folder for each feature.',
          list: [
            '<strong>recipe</strong>, <strong>function</strong>, <strong>loot_table</strong>, <strong>advancement</strong> and <strong>tags</strong>.',
            'In older versions some are plural (recipes, functions) or different (loot_tables).',
            'Match the folder to your Minecraft version.'
          ],
          fill: { sentence: 'Commands live in the [function|8] folder.' },
          quiz: { q: 'Which folder holds loot tables in 1.21 and newer?', opts: ['loot_table', 'loot_tables', 'drops'], correct: 0 }
        },
        {
          emoji: '🧭', title: 'Reading Ids', blurb: 'namespace:name',
          goal: 'Understand how ids point at your files.',
          list: [
            'Your content is found by <strong>namespace:name</strong>.',
            'The name is the file name without .json or .mcfunction.',
            'So mypack:hello points at data/mypack/function/hello.mcfunction.'
          ],
          fill: { sentence: 'A resource is found by namespace:[name|4].' },
          quiz: { q: 'What does mypack:hello point to?', opts: ['data/mypack/function/hello.mcfunction', 'saves/hello', 'The chat'], correct: 0 }
        }
      ],
      finishTitle: 'A Tidy Datapack!',
      finishSub: 'You can organise a datapack and read its ids. Next you write functions full of commands.',
    },
    {
      slug: 'minecraft-world-ep4-functions', num: 4, level: 'Improver',
      heroLine1: 'Run a List of Commands', title: 'Episode 4: Functions',
      cta: '📜 Start Step 1',
      badge: '⛏️ Episode 4 · Improver · Functions',
      sub: 'A function is a list of commands Minecraft runs on demand. They let you build a whole sequence of actions and trigger it with one word.',
      mins: '~50 mins',
      skills: [['📜', '.mcfunction'], ['▶️', '/function'], ['⛓️', 'Sequences'], ['🧪', 'Trigger it']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> anything you can type in chat, you can save in a function. One command in, a whole routine out.' }
      ],
      steps: [
        {
          emoji: '📜', title: 'Write a Function', blurb: 'One command per line',
          goal: 'Create a .mcfunction file.',
          list: [
            'Make a file in <strong>data/&lt;namespace&gt;/function/</strong> ending in <strong>.mcfunction</strong>.',
            'Each line is one command, without the leading slash.',
            'Blank lines and lines starting with # are ignored.'
          ],
          code: 'say Welcome to my datapack!\ntime set day\nweather clear',
          fill: { sentence: 'In a function file, each line is one [command|7] without the slash.' },
          quiz: { q: 'What kind of file is a function?', opts: ['A .mcfunction file', 'A .json file', 'A .png file'], correct: 0 }
        },
        {
          emoji: '▶️', title: 'Run It', blurb: '/function namespace:name',
          goal: 'Trigger your function in-game.',
          list: [
            'Type <strong>/function mypack:hello</strong> (namespace:name).',
            'All the commands run in order, instantly.',
            'Handy for testing: run it again and again while you edit.'
          ],
          fill: { sentence: 'You run a function with /function [namespace|9]:name.' },
          quiz: { q: 'How do you run a function called mypack:hello?', opts: ['/function mypack:hello', '/run hello', '/mypack hello'], correct: 0 }
        },
        {
          emoji: '⛓️', title: 'Chain a Routine', blurb: 'Build a sequence',
          goal: 'Make a function that does several things in order.',
          list: [
            'Put commands one after another to build a routine.',
            'A function can call another function by name.',
            'Order matters: the top line runs first.'
          ],
          code: 'function mypack:clear_area\nfill ~-5 ~ ~-5 ~5 ~5 ~5 minecraft:air\nsay The area is clear!',
          fill: { sentence: 'A function can call another [function|8] by name.' },
          quiz: { q: 'Which line of a function runs first?', opts: ['The top line', 'The bottom line', 'A random line'], correct: 0 }
        },
        {
          emoji: '🧪', title: 'Test and Tidy', blurb: 'Small steps',
          goal: 'Test each command on its own first.',
          list: [
            'Test commands in chat first, then paste the working ones into the function.',
            'If a command errors, the ones after it still try to run. Check the log.',
            'Give functions clear names so you can find them later.'
          ],
          fill: { sentence: 'Test risky commands in chat before adding them to a [function|8].' },
          quiz: { q: 'Why test a command in chat first?', opts: ['To see it work before saving it', 'It is faster to type', 'Functions cannot be edited'], correct: 0 }
        }
      ],
      finishTitle: 'Commands on Demand!',
      finishSub: 'You can bundle commands into functions. Next you make blocks and chests drop your own loot.',
    },
    {
      slug: 'minecraft-world-ep5-loot', num: 5, level: 'Improver',
      heroLine1: 'Decide What Drops', title: 'Episode 5: Loot Tables',
      cta: '🎁 Start Step 1',
      badge: '⛏️ Episode 5 · Improver · Loot',
      sub: 'A loot table decides what an action produces: what a block drops, what is in a chest, or what a mob leaves behind. Learn to write your own.',
      mins: '~50 mins',
      skills: [['🎁', 'Loot table'], ['🎲', 'Pools & rolls'], ['⚖️', 'Chance'], ['🔗', 'Attach it']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> loot tables are where you add a little luck to your pack. A rare drop feels amazing when you got the odds right.' }
      ],
      steps: [
        {
          emoji: '🎁', title: 'The Loot File', blurb: 'Where loot lives',
          goal: 'Create a loot table file.',
          list: [
            'Loot tables go in <strong>data/&lt;namespace&gt;/loot_table/</strong> (loot_tables in older versions).',
            'The file describes pools of entries.',
            'Each pool can roll a number of times.'
          ],
          fill: { sentence: 'Loot tables go in data/&lt;namespace&gt;/[loot_table|10]/.' },
          quiz: { q: 'What is a loot table?', opts: ['A rule for what an action drops', 'A type of block', 'A music track'], correct: 0 }
        },
        {
          emoji: '🎲', title: 'Pools and Rolls', blurb: 'Draw the prize',
          goal: 'Write a simple pool.',
          list: [
            '<strong>pools</strong> is a list. Each pool has <strong>rolls</strong> and <strong>entries</strong>.',
            'rolls is how many times it draws from the entries.',
            'An entry can be an item, and can have a <strong>weight</strong> to make it rare.'
          ],
          code: '{\n  "type": "minecraft:block",\n  "pools": [{\n    "rolls": 1,\n    "entries": [\n      { "type": "minecraft:item", "name": "minecraft:diamond", "weight": 1 },\n      { "type": "minecraft:item", "name": "minecraft:coal", "weight": 5 }\n    ]\n  }]\n}',
          fill: { sentence: 'To make an item rarer, give it a smaller [weight|6].' },
          quiz: { q: 'Which item is rarer in the example?', opts: ['The diamond (weight 1)', 'The coal (weight 5)', 'They are equal'], correct: 0 }
        },
        {
          emoji: '⚖️', title: 'Chance and Count', blurb: 'Tune the odds',
          goal: 'Understand chance and stacking.',
          list: [
            'A lower weight means a lower chance.',
            'You can give a drop a range of counts, like 1 to 3.',
            'Test by breaking the block many times and counting the drops.'
          ],
          fill: { sentence: 'A lower weight means a [lower|5] chance.' },
          quiz: { q: 'How do you test a loot table?', opts: ['Do the action many times and count the drops', 'Read it once', 'Guess'], correct: 0 }
        },
        {
          emoji: '🔗', title: 'Attach It', blurb: 'Make it happen',
          goal: 'Point something at your loot table.',
          list: [
            'A block or mob points at a loot table by its id, like mypack:blocks/treasure.',
            'For chests, set the loot table in the chest NBT or with a function.',
            'Reload and test in-game.'
          ],
          fill: { sentence: 'A thing points at a loot table by its [id|2].' },
          quiz: { q: 'What is the main job of a loot table?', opts: ['Decide what drops when something happens', 'Change the sky colour', 'Rename blocks'], correct: 0 }
        }
      ],
      finishTitle: 'Your Own Drops!',
      finishSub: 'You can control loot. Next you use tags to group items and let recipes work with whole families of blocks.',
    },
    {
      slug: 'minecraft-world-ep6-tags-advancements', num: 6, level: 'Improver',
      heroLine1: 'Group and Reward', title: 'Episode 6: Tags and Advancements',
      cta: '🏷️ Start Step 1',
      badge: '⛏️ Episode 6 · Improver · Tags & Goals',
      sub: 'Tags group items and blocks so your pack can talk about whole families at once. Advancements create custom goals and rewards. Together they make a pack feel like a game.',
      mins: '~55 mins',
      skills: [['🏷️', 'Tags'], ['✅', 'Advancements'], ['🎉', 'Rewards'], ['🧪', 'Test goals']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> tags are how you say "any plank" instead of listing every plank. Advancements are how you say "well done". Both make players feel clever.' }
      ],
      steps: [
        {
          emoji: '🏷️', title: 'What Tags Are', blurb: 'Name a group',
          goal: 'Understand item and block tags.',
          list: [
            'A tag is a named list of items or blocks, like <strong>mypack:shiny</strong>.',
            'Tags live in <strong>data/&lt;namespace&gt;/tags/item/</strong> (or tags/items/ in older versions).',
            'Recipes and functions can refer to a whole tag at once.'
          ],
          fill: { sentence: 'A tag is a named [list|4] of items or blocks.' },
          quiz: { q: 'Why use a tag instead of listing every block?', opts: ['So you can refer to a whole family at once', 'It is shorter to type', 'Tags look nice'], correct: 0 }
        },
        {
          emoji: '✅', title: 'Write a Tag', blurb: 'List the members',
          goal: 'Create an item tag.',
          list: [
            'A tag file is JSON with a <strong>values</strong> list.',
            'Each value is a full item id, or another tag with a # in front.',
            'Give it a clear name so recipes read well.'
          ],
          code: '{\n  "values": [\n    "minecraft:oak_planks",\n    "minecraft:birch_planks",\n    "minecraft:spruce_planks"\n  ]\n}',
          fill: { sentence: 'A tag file has a [values|6] list of items.' },
          quiz: { q: 'What goes in a tag values list?', opts: ['Full item ids', 'File paths', 'Sounds'], correct: 0 }
        },
        {
          emoji: '🎉', title: 'Make an Advancement', blurb: 'A custom goal',
          goal: 'Create an advancement with a reward.',
          list: [
            '<strong>advancement</strong>, <strong>display</strong>, and <strong>criteria</strong> are the main parts.',
            'criteria describes what the player must do, using a trigger.',
            'rewards can run a function when they earn it.'
          ],
          code: '{\n  "criteria": {\n    "get_diamond": { "trigger": "minecraft:inventory_changed" }\n  },\n  "rewards": { "function": "mypack:reward" }\n}',
          fill: { sentence: 'An advancement lists its goals under [criteria|8].' },
          quiz: { q: 'What does the rewards section do?', opts: ['Runs something when the goal is earned', 'Shows the title', 'Stores items'], correct: 0 }
        },
        {
          emoji: '🧪', title: 'Reward and Test', blurb: 'Make it satisfying',
          goal: 'Give a reward and test it.',
          list: [
            'Point the reward at one of your functions.',
            'Earn the advancement in-game and watch it fire.',
            'Keep the reward meaningful but not overpowered.'
          ],
          fill: { sentence: 'An advancement reward can run one of your [functions|9].' },
          quiz: { q: 'A good reward should be what?', opts: ['Meaningful but balanced', 'Always the best item in the game', 'Nothing'], correct: 0 }
        }
      ],
      finishTitle: 'Your Pack Has Goals!',
      finishSub: 'You can group items and create rewards. Next you learn to debug a datapack when something breaks.',
    },
    {
      slug: 'minecraft-world-ep7-debug', num: 7, level: 'Advanced',
      heroLine1: 'When It Breaks', title: 'Episode 7: Fix the Log',
      cta: '🔍 Start Step 1',
      badge: '⛏️ Episode 7 · Advanced · Debug',
      sub: 'Datapacks break in small, fixable ways. In this episode you learn to read the game log and the reload error, and fix the mistakes everyone makes.',
      mins: '~45 mins',
      skills: [['🔍', 'Read the log'], ['🧯', 'Common errors'], ['✅', 'Validate JSON'], ['♻️', 'Reload loop']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> the error message almost always names the file and the line. Read it slowly. The first error is the one to fix.' }
      ],
      steps: [
        {
          emoji: '🔍', title: 'Read the Reload Message', blurb: 'Where errors appear',
          goal: 'Find and read a datapack error.',
          list: [
            'Type /reload. If something is wrong, the game prints a red error in chat.',
            'The message names the file and usually the line and column.',
            'Fix the <strong>first</strong> error, then reload again.'
          ],
          fill: { sentence: 'Fix the [first|5] error before the others.' },
          quiz: { q: 'Which error do you fix first?', opts: ['The first one shown', 'The last one', 'A random one'], correct: 0 }
        },
        {
          emoji: '🧯', title: 'The Usual Mistakes', blurb: 'Fast fixes',
          goal: 'Recognise the common datapack errors.',
          list: [
            'A <strong>trailing comma</strong> or missing colon in JSON.',
            'A <strong>space</strong> in a namespace or file name.',
            'The wrong <strong>folder name</strong> for your version (recipe vs recipes).',
            'An item id that is <strong>misspelled</strong> or missing minecraft:.',
            'The wrong <strong>pack_format</strong> for your version.'
          ],
          fill: { sentence: 'A very common JSON error is a trailing [comma|5].' },
          quiz: { q: 'Your JSON will not load. First thing to look for?', opts: ['A trailing comma or missing colon', 'The colour', 'The file size'], correct: 0 }
        },
        {
          emoji: '✅', title: 'Check Your JSON', blurb: 'Catch errors early',
          goal: 'Validate JSON before loading.',
          list: [
            'Use a free JSON checker to spot bracket and comma errors.',
            'Quote every key and string properly.',
            'Keep your editor set to plain text so it does not add smart quotes.'
          ],
          fill: { sentence: 'A JSON [checker|7] spots bracket and comma errors before you load.' },
          quiz: { q: 'Why use a JSON checker?', opts: ['It catches syntax errors before the game does', 'It makes the pack faster', 'It is required'], correct: 0 }
        },
        {
          emoji: '♻️', title: 'The Reload Loop', blurb: 'Change, reload, repeat',
          goal: 'Work in small, testable steps.',
          list: [
            'Change one thing, /reload, then test it.',
            'Keep a working copy you can fall back to.',
            'Small steps mean you always know what broke it.'
          ],
          fill: { sentence: 'Change one thing, then /[reload|6], then test.' },
          quiz: { q: 'Why make one small change at a time?', opts: ['So you know what caused a new error', 'It looks neat', 'The game requires it'], correct: 0 }
        }
      ],
      finishTitle: 'You Can Debug a Pack!',
      finishSub: 'You can read the log and fix the common mistakes. Next you design a themed pack that feels like one thing.',
    },
    {
      slug: 'minecraft-world-ep8-design-share', num: 8, level: 'Capstone',
      heroLine1: 'Make It Yours, Share It', title: 'Episode 8: Design and Share',
      cta: '🚀 Start Step 1',
      badge: '⛏️ Episode 8 · Capstone · Share',
      sub: 'The final step: tie your recipes, functions, loot and advancements into one themed pack, then package and share it so other players can enjoy it.',
      mins: '~55 mins',
      skills: [['🎨', 'Theme'], ['📦', 'Package'], ['📝', 'README'], ['🌍', 'Share safely']],
      intro: [
        { k: 'info', icon: '🔥', html: '<strong>Ember says:</strong> one clear theme beats ten random features. Decide what your pack is about, then make every piece serve that idea.' }
      ],
      steps: [
        {
          emoji: '🎨', title: 'Pick a Theme', blurb: 'One clear idea',
          goal: 'Write one sentence your whole pack serves.',
          list: [
            'A theme makes the pack feel like a product, not a pile of files.',
            'Example: "a treasure hunt that rewards explorers".',
            'Every recipe and advancement should fit the theme.'
          ],
          fill: { sentence: 'A good theme fits on [one|3] sentence.' },
          quiz: { q: 'Why pick a theme?', opts: ['So the pack feels like one thing, not a pile', 'It is required by Minecraft', 'To make it slower'], correct: 0 }
        },
        {
          emoji: '📦', title: 'Package It', blurb: 'One tidy zip',
          goal: 'Zip your pack so it installs cleanly.',
          list: [
            'The zip must hold <strong>pack.mcmeta</strong> at its top level, not in a sub-folder.',
            'Name it clearly, like <em>mypack-v1.zip</em>.',
            'Test by dropping the zip into a fresh world datapacks folder.'
          ],
          fill: { sentence: 'The zip must have pack.mcmeta at the [top|3] level.' },
          quiz: { q: 'What must be at the top level of the zip?', opts: ['pack.mcmeta', 'The world save', 'A screenshot'], correct: 0 }
        },
        {
          emoji: '📝', title: 'Write a README', blurb: 'Help the next player',
          goal: 'Write a short README.',
          list: [
            'What the pack does, in one line.',
            'Which Minecraft version it needs (and the pack_format).',
            'How to install it and how to remove it.'
          ],
          fill: { sentence: 'A README says what the pack does and which [version|7] it needs.' },
          quiz: { q: 'What should a README include?', opts: ['What it does, the version, and how to install and remove it', 'Your favourite colour', 'Nothing'], correct: 0 }
        },
        {
          emoji: '🌍', title: 'Share Safely', blurb: 'Pass it on',
          goal: 'Share your pack without sharing private details.',
          list: [
            'Share only the zip.',
            'Never include personal details in the files.',
            'Ask a grown-up before posting online, and give credit for anything you reused.'
          ],
          fill: { sentence: 'Never share [personal|8] details in a datapack.' },
          quiz: { q: 'What must never go into a shared datapack?', opts: ['Personal details', 'Recipes', 'Functions'], correct: 0 }
        },
        {
          emoji: '🏆', title: 'Claim Your Badge', blurb: 'You finished the series',
          goal: 'Look back at everything you can do now.',
          list: [
            'You can set up a datapack and load it.',
            'You can write recipes, functions, loot tables, tags and advancements.',
            'You can debug a pack and share it safely.',
            'You built a whole datapack from nothing.'
          ],
          fill: { sentence: 'You are now a Redstone [Architect|9].' },
          quiz: { q: 'What can you do now that you could not before?', opts: ['Build, debug and share a complete Minecraft datapack', 'Fly in real life', 'Nothing'], correct: 0 }
        }
      ],
      finishTitle: 'Redstone Architect!',
      finishSub: 'You built a complete datapack: recipes, commands, loot, tags, goals and a clean package. That is a real Minecraft mod, made with no install at all. Go make another one!',
    }
  ]
};

module.exports = [OPENRCT2, MUGEN, MINECRAFT];

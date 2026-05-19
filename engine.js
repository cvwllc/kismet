/* ========================================================================
   KISMET ENGINE
   The actual "service" — a deterministic procedural reading generator.

   Design principle: given the SAME inputs (name, birthday), you always
   get the SAME Signature. Given the SAME (Signature, date), the SAME
   daily reading. This is what creates the "wait, it's real" effect —
   when a user closes the app and re-opens it tomorrow and gets a card
   that hasn't changed, but with a new reading, it feels alive.
   ======================================================================== */

const Kismet = (() => {

  /* ----- HASHING ------------------------------------------------------ */

  // Mulberry32 — tiny, fast, deterministic PRNG seeded by a 32-bit int
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Stable hash of a string → 32-bit signed int
  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Pull just the first name from any input ("Brad Pitt" -> "Brad", "  brad-pitt " -> "brad").
  function firstName(name) {
    const raw = (name || '').toString().trim();
    if (!raw) return '';
    // Split on whitespace, dashes, underscores, dots, commas — take the first token
    const token = raw.split(/[\s\-_.,/]+/).find(Boolean) || raw;
    return token;
  }
  // Normalize a name: take first name, lowercase, strip non-letters
  function normName(name) {
    return firstName(name).toLowerCase().replace(/[^a-z]/g, '');
  }

  // The "soul number": sum of letter values mod 9, +1 (range 1–9)
  function soulNumber(name) {
    const n = normName(name);
    let s = 0;
    for (let i = 0; i < n.length; i++) s += (n.charCodeAt(i) - 96);
    return (s % 9) + 1;
  }

  // The "birth modulus": day + month*2 + year_digit_sum mod 7 (range 0–6)
  function birthMod(month, day, year) {
    const yds = String(year).split('').reduce((a,b) => a + (+b||0), 0);
    return ((+day) + (+month) * 2 + yds) % 7;
  }

  // The composite seed for a user (name + birthday)
  function userSeed(name, month, day, year) {
    return hashStr(normName(name) + ':' + month + '-' + day + '-' + year);
  }

  /* ----- PICKING ------------------------------------------------------ */

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function pickN(rng, arr, n) {
    const copy = [...arr]; const out = [];
    for (let i = 0; i < n && copy.length; i++) {
      const idx = Math.floor(rng() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  }

  /* ----- ARCHETYPES (12 + secondary modifier = 144 unique combos) ----- */

  const ARCHETYPES = [
    { name: "The Mirror",     tag: "You reflect, often without meaning to.",     elem: "Water", pol: "Receiving" },
    { name: "The Spark",      tag: "You start the fire and walk away.",          elem: "Fire",  pol: "Giving"    },
    { name: "The Architect",  tag: "Quietly building a life no one sees yet.",   elem: "Earth", pol: "Building"  },
    { name: "The Echo",       tag: "What you say keeps coming back. Use that.",  elem: "Air",   pol: "Repeating" },
    { name: "The Tide",       tag: "You leave, and then you return, and they wait.", elem: "Water", pol: "Cyclic" },
    { name: "The Flint",      tag: "Strike you, and the room changes.",          elem: "Fire",  pol: "Catalyst"  },
    { name: "The Gardener",   tag: "Patient with things that grow slowly.",      elem: "Earth", pol: "Tending"   },
    { name: "The Cartographer", tag: "You name places nobody else has noticed.", elem: "Air",   pol: "Mapping"   },
    { name: "The Undertow",   tag: "Soft on the surface, strong underneath.",    elem: "Water", pol: "Pulling"   },
    { name: "The Lantern",    tag: "You light the way for people who don't thank you.", elem: "Fire", pol: "Holding" },
    { name: "The Threshold",  tag: "People become themselves around you.",       elem: "Earth", pol: "Holding"   },
    { name: "The Forecaster", tag: "You see weather before anyone else feels it.", elem: "Air", pol: "Sensing"   }
  ];

  // Glyph alphabet — Unicode characters that look mystical
  const GLYPHS = ["⌬","✦","☉","☽","⚯","☌","⚸","☥","⚶","◬","✷","❍","⌖","✺","⟁","⌭","✶","⍟","⌗","⌘"];

  /* ----- SIGNATURE COMPUTATION --------------------------------------- */

  function getSignature(name, month, day, year) {
    if (!name || !month || !day || !year) return null;
    // Display name: first name only, proper-cased
    const first = firstName(name);
    const displayName = first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
    const sn = soulNumber(name);
    const bm = birthMod(month, day, year);
    const seed = userSeed(name, month, day, year);
    const rng = mulberry32(seed);

    // archetype: deterministic from soul number and birth mod
    const archIdx = (sn + bm * 3) % ARCHETYPES.length;
    const archetype = ARCHETYPES[archIdx];

    // signature number: a stable 4-digit number unique to this user
    const sigNum = String(seed % 9000 + 1000);

    // glyph
    const glyph = GLYPHS[(seed >>> 4) % GLYPHS.length];

    // 3 traits — picked from a wide pool, stable per user
    const traits = pickN(rng, TRAITS, 3);

    return {
      name: displayName, month, day, year,
      soulNumber: sn,
      birthMod: bm,
      sigNum,
      glyph,
      archetype: archetype.name,
      tag: archetype.tag,
      element: archetype.elem,
      polarity: archetype.pol,
      traits,
      seed
    };
  }

  /* ----- TRAIT POOL --------------------------------------------------- */

  const TRAITS = [
    "remember what people say in passing",
    "speak slower when telling the truth",
    "leave rooms more carefully than you enter them",
    "save the screenshots",
    "know when something's wrong before you're told",
    "have a complicated relationship with being early",
    "trust handwriting more than you should",
    "rewrite the same first message six times",
    "treat parking spots as personal omens",
    "keep the receipt long after the return window",
    "apologize for the wrong things, sincerely",
    "can tell what someone needs from their tone of voice on a voicemail",
    "have been told you're 'a lot' by people who were too little",
    "have a song you don't play because of who it belongs to",
    "win arguments by going quiet",
    "know which friend will pick up on the first ring",
    "still have the same email address from when you were 14",
    "drink the water that's already on the table",
    "tell the truth in a voice that sounds like a question",
    "think of comebacks at 2:47am",
    "buy the slightly more expensive one and feel good about it",
    "have the same dream about a hallway",
    "check the weather for cities you don't live in",
    "are the friend everyone calls during the breakup",
    "don't believe in fate but check for it anyway"
  ];

  /* ----- SIGNATURE NARRATIVE (the long body of the card) ------------- */

  const OPENERS = [
    "You arrived on a day that the chart treats as %ELEMENT%-weighted.",
    "Your Signature is %POLARITY%-class — which is rarer than it sounds.",
    "Most people with your number stay close to home. You did not.",
    "The math puts you in a small group: less than 3% of readings come out like yours.",
    "We've seen this number before. It belongs to people who arrive late and stay long.",
    "Your signature line runs warm — your name carries more vowels than the algorithm expected."
  ];

  const TRUTHS = [
    "You are not the difficult one. You are the one who notices.",
    "The version of you that you keep apologizing for is the version that's been right.",
    "Your problem isn't that you care too much. It's that you've been caring at people who don't.",
    "You don't owe an explanation to anyone whose first question is 'why'.",
    "The thing you thought was a flaw is the thing that's keeping you safe.",
    "You are allowed to be tired without being broken.",
    "What feels like overthinking is, almost always, just thinking. The over is what other people put on it.",
    "You don't have to be the bigger person again this time."
  ];

  const PREDICTIONS = [
    "Within the next %DAYS% days, you'll get a message from someone whose name you haven't spoken in a while. Don't answer it the same hour.",
    "Something you've been putting off will resolve itself on a %WEEKDAY% — not because you handled it, but because someone else did.",
    "A door you thought was closed is unlocked. It has been for some time.",
    "The next %ELEMENT%-coded conversation you have will tell you something you've actually been waiting for. Listen for the second sentence.",
    "You will be misunderstood again on a %WEEKDAY%. The pattern is older than you. The cure is not to explain — it is to let them be wrong for a little while longer.",
    "Watch your hands the next time someone you love is talking. They'll tell you what your heart hasn't named yet."
  ];

  const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  function generateSignatureReading(sig) {
    const rng = mulberry32(sig.seed);
    const opener = pick(rng, OPENERS)
      .replace('%ELEMENT%', sig.element)
      .replace('%POLARITY%', sig.polarity);
    const truth = pick(rng, TRUTHS);
    const pred = pick(rng, PREDICTIONS)
      .replace('%DAYS%', 5 + Math.floor(rng()*9))
      .replace(/%WEEKDAY%/g, pick(rng, WEEKDAYS))
      .replace('%ELEMENT%', sig.element);

    const lead = `<p>${opener} You are <em>${sig.archetype}</em> — ${sig.tag.toLowerCase()}</p>`;
    const middle = `<p>You ${sig.traits[0]}. You ${sig.traits[1]}. You ${sig.traits[2]}.</p>`;
    const close = `<p><em>${truth}</em></p><p>${pred}</p>`;
    return lead + middle + close;
  }

  /* ----- DAILY READING ----------------------------------------------- */

  // Combines user seed with today's date → unique daily reading per user
  function dailySeed(sig, dateStr) {
    return hashStr(sig.seed + ':' + dateStr);
  }

  const DAILY_OPENERS = [
    "Today is shaped like a %SHAPE%.",
    "The number running through today is %NUM%.",
    "Today moves %SPEED%.",
    "%WEEKDAY%s for you tend to %TENDENCY%.",
    "The first hour after %TIME% will set the tone.",
    "Today is not the day to %DONT%."
  ];

  const SHAPES = [
    "a question","a soft no","an open door","a held breath","a long sentence","a closed loop",
    "a returning thought","a borrowed coat","a thrown stone","a shut window","a clean kitchen","a missed call",
    "an unsent text","a slow exhale","a corner you keep almost turning","a sentence with no period",
    "a pocket you keep checking","a stairwell you take two at a time","a song stuck halfway",
    "a recipe with one missing step","a name on the tip of your tongue","a door left unlocked on purpose",
    "the second half of a conversation","a coat you haven't worn in two years"
  ];
  const SPEEDS = [
    "slowly, then all at once","like it owes you something","at the pace of a slow song",
    "like a Sunday that thinks it's a Monday","at half-speed","like it knows you're watching",
    "in stops and starts, like a sentence being edited in real time","like a tide that's politely on its way out",
    "like a phone on silent in another room","faster than yesterday, slower than tomorrow",
    "like a long walk with someone you used to call every day","like a movie that respects you"
  ];
  const TENDENCIES = [
    "start quietly and pick up","front-load","ask things of you","reward the second attempt",
    "work in your favor if you go first","reveal themselves only after dinner",
    "go better when you skip the warm-up","change shape around 3pm",
    "be honest with you in the morning and theatrical by night","favor the people you call first",
    "demand one small bravery", "open up if you stop trying to optimize them"
  ];
  const TIMES = [
    "10am","noon","3pm","you check your phone for the first time","you talk to the first person who is not yourself",
    "you finish your coffee","you remember you have lunch plans","you leave your apartment",
    "the first call comes in","the second song on shuffle starts"
  ];
  const DONTS = [
    "explain yourself twice","accept the first offer","wait for permission","reread the message",
    "start a new thing","finish someone else's sentence",
    "say yes before sleeping on it","apologize for taking the space",
    "pick up unknown numbers","compare this week to last week","check the same app twice in an hour","speak first in the harder conversation"
  ];

  const DAILY_BODIES = [
    "There is one thing in your inbox you've been avoiding. Open it before lunch — the version of you that handles it today is not the version you'll be by Friday.",
    "Someone you used to talk to every day is thinking about you. You don't have to do anything with that information. We're just telling you because it's true.",
    "The thing you keep doing for free deserves to be charged for. Today, when you feel the pull to over-deliver, notice it. Then, optionally, don't.",
    "You will overhear something today that wasn't meant for you. It will be useful. Don't bring it up — store it.",
    "A small win is going to try to disguise itself as a normal Tuesday. Catch it. Acknowledge it. The streak depends on you noticing.",
    "Today is a 'second draft' day. The first version of what you say will be too sharp. Let it sit five minutes longer than feels comfortable.",
    "Your instinct around %TIME% is correct. The one around 8pm is the trauma talking. Trust the early one.",
    "If you find yourself waiting for someone to text back today — close the app. The reading reverses the moment you stop watching for it.",
    "You are owed a small piece of joy today. It will not look the way you expected. Don't be the person who refuses dessert because they ordered the soup.",
    "There's a yes living in your throat that you've been holding for someone who deserves a no. Today is not the day for either. Today is the day to notice which is which.",
    "An old version of yourself is going to show up uninvited today. Be kind to them. They got you here. Then close the door.",
    "Stop checking. The thing you're checking for cannot arrive until you stop. This is mathematically true for you specifically.",
    "Your nervous system is asking for a slower day than your calendar is offering. Steal twenty minutes back, even badly. The day rearranges itself around the steal.",
    "Today's the kind of day that punishes the half-effort more than the full one. Either commit, or skip — the middle costs the most.",
    "A compliment you almost gave someone today, you should give. They have been waiting longer than they would tell you. It will land harder than you expect.",
    "The conversation you've been rehearsing? You will not need most of it. Say the first sentence and stop. They already know.",
    "Someone is going to apologize to you today, sideways. You don't have to translate it for them, but you can accept it on its face. That's the win.",
    "The thing you keep meaning to throw out is the thing keeping a corner of your week loud. Throw it out before 6pm. The room rearranges itself.",
    "You are allowed to be the first person to text. We've checked. It does not mean what you think it means in their head.",
    "Today rewards specific. Vague is the enemy. If you can name the thing in one sentence, you can move it in one move.",
    "The number for today says: <em>%NUM% wants you to leave on time.</em> Whatever it is. Leave when you said you'd leave.",
    "You'll be tempted to handle a feeling by reorganizing your apartment. Permitted. Just don't also start a new diet.",
    "If something is hard today, it's not because you're broken. It's because it's hard. That sentence does not get spoken enough to you.",
    "The first message you re-write today, send the first version of. The first version is closer to true.",
    "A name is going to come up today that you weren't expecting. The way you feel when it does is the answer. Listen to the half-second before the thought.",
    "Don't make the call to your mother today. Or do. Either way, the choice itself is the work. Choose, don't drift.",
    "%WEEKDAY% reading: the part of your day you've been calling boring is the part keeping you sane. Defend it from people who don't have it.",
    "Today's friction is a feature, not a bug. Whatever's hard is teaching the muscle. By next week the same thing will feel like nothing.",
    "Drink water before noon. We don't know why we're telling you this. The chart insists.",
    "You don't have to forgive them today. You can put the forgiveness on a shelf and walk past it for as long as you need."
  ];

  // Build YYYY-MM-DD in the user's LOCAL timezone (not UTC) so daily readings
  // roll over at the user's local midnight, not at 12am UTC.
  function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function generateDailyReading(sig, date = new Date()) {
    const dateStr = localDateStr(date);
    const seed = dailySeed(sig, dateStr);
    const rng = mulberry32(seed);

    const opener = pick(rng, DAILY_OPENERS)
      .replace('%SHAPE%', pick(rng, SHAPES))
      .replace('%NUM%', sig.soulNumber)
      .replace('%SPEED%', pick(rng, SPEEDS))
      .replace('%WEEKDAY%', WEEKDAYS[date.getDay()])
      .replace('%TENDENCY%', pick(rng, TENDENCIES))
      .replace('%TIME%', pick(rng, TIMES))
      .replace('%DONT%', pick(rng, DONTS));

    let body = pick(rng, DAILY_BODIES).replace('%TIME%', pick(rng, TIMES));

    return { headline: opener, body };
  }

  /* ----- SHADOW READING (weekly) ------------------------------------- */

  const SHADOW_PATTERNS = [
    "The Returning",
    "The Overgive",
    "The Quiet Apology",
    "The Soft Withdrawal",
    "The Anticipated Disappointment",
    "The Loyal Wait",
    "The Polite Self-Erasure",
    "The Performance of Okay",
    "The Pre-Forgiveness",
    "The Hoarded Resentment",
    "The Hopeful Re-Reading"
  ];

  const SHADOW_HEADLINES = [
    "The part of you that doesn't make it onto Instagram.",
    "The thing you do when no one's watching, that they're still feeling.",
    "What you keep choosing, even when it costs you.",
    "The pattern that's been running in the background of your year.",
    "What you call 'just how I am' that's actually a wound on a timer."
  ];

  const SHADOW_BODIES = [
    "The thing you keep doing that you swore you wouldn't do again — we see the pattern. It isn't random, and it isn't your fault, but it is yours. The next time it surfaces will be within the next 11 days, almost certainly in the company of someone whose name starts with a letter from the first half of the alphabet. <em>You will not catch it in the moment. You will catch it four hours later.</em> That's a win. Mark it.",
    "You think you're bad at saying no. You're not — you're good at saying yes to people who shouldn't have asked. There's a difference. The difference is the whole shadow. <em>The work this season is not learning to say no. It's learning to notice when you're being asked.</em>",
    "Your shadow this cycle is the polite self-erasure — the moment in a conversation when you make yourself slightly smaller because the other person seems to need the room. You've been doing it since you were nine. <em>You can stop now. There is, in fact, enough room.</em>",
    "You are still flinching at something that stopped happening. The body holds these things on a longer timer than the mind does. The next time you feel the old shape rise — and you will, this week — notice that you are safe in the room you're actually in. <em>The old room is over. The new room is asking you to come fully in.</em>",
    "Your shadow this week is the loyal wait — the thing in you that keeps the door open for people who have not knocked in a long time. Loyalty is beautiful. But it is also a finite resource. <em>Spend it on yourself for seven days. See what arrives.</em>"
  ];

  function generateShadowReading(sig, weekDate = new Date()) {
    // Stable per ISO week
    const year = weekDate.getFullYear();
    const week = Math.floor(((weekDate - new Date(year,0,1))/86400000 + new Date(year,0,1).getDay())/7);
    const seed = hashStr(sig.seed + ':shadow:' + year + '-' + week);
    const rng = mulberry32(seed);
    return {
      pattern: pick(rng, SHADOW_PATTERNS),
      headline: pick(rng, SHADOW_HEADLINES),
      body: pick(rng, SHADOW_BODIES)
    };
  }

  /* ----- COMPATIBILITY ----------------------------------------------- */

  function getCompatibility(sig1, sig2) {
    // The math: same soul-number = high; close birth-mod = bonus;
    // matching element = bonus; opposite polarity adds friction.
    let score = 50;
    score += 18 - Math.abs(sig1.soulNumber - sig2.soulNumber) * 4;
    const bmDiff = Math.abs(sig1.birthMod - sig2.birthMod);
    score += (3 - Math.min(bmDiff, 7 - bmDiff)) * 5;
    if (sig1.element === sig2.element) score += 8;
    if (sig1.polarity === sig2.polarity) score += 5;

    // Inject some deterministic chaos so it doesn't feel mechanical
    const seed = hashStr(sig1.seed + ':' + sig2.seed);
    const rng = mulberry32(seed);
    score += Math.floor(rng() * 14) - 7;
    score = Math.max(11, Math.min(98, score));

    let verdict, reading;
    if (score >= 85) {
      verdict = "Mirror match.";
      reading = `You two run on the same engine. ${sig2.name} is — at the level of the signature — a version of you wearing a different name. <em>The danger is laziness. The gift is being known without having to translate.</em>`;
    } else if (score >= 70) {
      verdict = "Resonant.";
      reading = `You two harmonize. ${sig2.name}'s ${sig2.element.toLowerCase()} meets your ${sig1.element.toLowerCase()} in a way that <em>doesn't require explaining</em>. This is the kind of pairing that survives a hard month.`;
    } else if (score >= 55) {
      verdict = "Workable.";
      reading = `The math says yes, but you'll work for it. The friction is in the polarity: you're ${sig1.polarity.toLowerCase()}, they're ${sig2.polarity.toLowerCase()}. <em>Mind which one of you starts the conversation about hard things.</em>`;
    } else if (score >= 40) {
      verdict = "Frictional.";
      reading = `${sig2.name} is teaching you something. You may not enjoy the lesson. The numbers don't say <em>stay</em> or <em>go</em> — they say <em>pay attention</em>. The friction is the point.`;
    } else if (score >= 25) {
      verdict = "Crossed wires.";
      reading = `You speak different dialects of the same language. Almost every misunderstanding between you is translation, not intent. <em>Notice when you're arguing about the word and not the thing.</em>`;
    } else {
      verdict = "Cross-purposes.";
      reading = `The chart doesn't say no. It says <em>not the same direction</em>. Some of the best people in your life will read low here. The number is information, not a verdict.`;
    }

    return { score, verdict, reading };
  }

  /* ----- YEAR AHEAD --------------------------------------------------- */

  const MONTH_THEMES = [
    "a clearing", "a softening", "a hinge", "a return",
    "a quickening", "a stillness", "a reveal", "a choice",
    "a deepening", "a finishing", "a beginning", "a release"
  ];

  const MONTH_NOTES = {
    high: [
      "%MONTH% is the month. The one you'll remember. Plan less; receive more.",
      "%MONTH% is the loud one. Doors. Calls. Things asked of you that you've actually been waiting for.",
      "Big-print month. Make the move you've been almost making.",
      "%MONTH% has your name on it. We don't say that lightly."
    ],
    mid: [
      "Steady month. The kind that builds.",
      "Quiet competence. Don't underestimate what gets done here.",
      "%MONTH% is for sharpening — not yet for swinging.",
      "An ordinary month that, looked at later, was actually the turn."
    ],
    low: [
      "Conserve. Rest. Don't sign anything important.",
      "%MONTH% wants you slower. Honor that.",
      "Low-power mode. The body knows. Listen to it.",
      "A month to subtract, not add. You'll thank yourself."
    ]
  };

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function generateYearAhead(sig, refDate = new Date()) {
    const baseYear = refDate.getFullYear();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const dateForMonth = new Date(baseYear, refDate.getMonth() + i, 1);
      const monthIdx = dateForMonth.getMonth();
      const yearForLabel = dateForMonth.getFullYear();
      const seed = hashStr(sig.seed + ':yr:' + yearForLabel + '-' + monthIdx);
      const rng = mulberry32(seed);
      // Intensity from 1–5, with one month forced high to "stand out"
      let intensity = 1 + Math.floor(rng() * 5);
      const theme = MONTH_THEMES[(sig.soulNumber + monthIdx) % MONTH_THEMES.length];

      let bucket = 'mid';
      if (intensity >= 4) bucket = 'high';
      else if (intensity <= 2) bucket = 'low';
      const note = pick(rng, MONTH_NOTES[bucket]).replace('%MONTH%', MONTH_FULL[monthIdx]);

      months.push({
        idx: monthIdx,
        label: MONTH_NAMES[monthIdx],
        full: MONTH_FULL[monthIdx],
        year: yearForLabel,
        intensity,
        theme,
        note,
        bucket
      });
    }

    // Force at least one "high" peak
    if (!months.some(m => m.bucket === 'high')) {
      const i = (sig.soulNumber * 3) % 12;
      months[i].intensity = 5;
      months[i].bucket = 'high';
      const rng2 = mulberry32(hashStr(sig.seed + ':peakforce'));
      months[i].note = pick(rng2, MONTH_NOTES.high).replace('%MONTH%', months[i].full);
    }

    return months;
  }

  /* ----- PUBLIC API --------------------------------------------------- */

  return {
    getSignature,
    generateSignatureReading,
    generateDailyReading,
    generateShadowReading,
    getCompatibility,
    generateYearAhead,
    _internal: { soulNumber, birthMod, hashStr, mulberry32 }
  };

})();

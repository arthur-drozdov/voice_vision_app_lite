/**
 * Index (Landing/Home) Page
 * 
 * A "Living Foyer" that evolves based on user permissions.
 * - Dynamic greeting based on time of day + tone
 * - Trust & Memory consent modal (first visit)
 * - Daily Spark Engine (personalised card based on active permissions)
 * - Memory Lane carousel (recent meaningful interactions)
 * - Context-aware Quick Actions
 * - Character selection and mode cards
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MessageCircle, Video, PenTool, Sparkles, ChevronRight,
  Brain, Lightbulb, Heart, Leaf, Music,
} from "lucide-react";
import CharacterSelect, { characters, Character } from "@/components/CharacterSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GlassContainer from "@/components/GlassContainer";
import OrbitWrap from "@/components/OrbitWrap";
import FocusButton from "@/components/FocusButton";
import TrustMemoryModal from "@/components/TrustMemoryModal";
import { getUserName } from "@/lib/userProfileStore";
import {
  hasCompletedOnboarding,
  getPermissions,
  isMemoryAllowed,
  enabledCategories,
} from "@/lib/memoryPermissions";
import { getBoards } from "@/lib/canvasStore";

interface ModeOption {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  gradient: string;
}

const modeOptions: ModeOption[] = [
  {
    id: "chat",
    label: "Chat",
    description: "Text-based conversation with voice support",
    icon: MessageCircle,
    path: "/chat",
    gradient: "from-blue-500/20 to-cyan-500/20",
  },
  {
    id: "video",
    label: "Video",
    description: "Full-duplex video call with AI",
    icon: Video,
    path: "/video",
    gradient: "from-purple-500/20 to-pink-500/20",
  },
  {
    id: "canvas",
    label: "Canvas",
    description: "Draw and collaborate visually",
    icon: PenTool,
    path: "/canvas",
    gradient: "from-green-500/20 to-emerald-500/20",
  },
];

/* ─── Daily Spark content ─────────────────────────────────────────────────── */

interface SparkItem {
  emoji: string;
  title: string;
  description: string;
  action?: string;
  category: string;
}

const SPARK_POOL: SparkItem[] = [
  // Preferences / News
  { emoji: "📰", title: "Morning briefing", description: "Catch up on the topics you care about most.", action: "Summarise my news", category: "preferences" },
  { emoji: "🎵", title: "Your sonic mood", description: "A playlist matched to your current vibe.", action: "Play something nice", category: "preferences" },
  // Wellness
  { emoji: "🧘", title: "Two-minute breather", description: "A quick guided breathing exercise to reset.", action: "Start breathing", category: "wellness" },
  { emoji: "🌿", title: "Mindful moment", description: "Take a pause. You've earned it.", action: "Guide me", category: "wellness" },
  // Creative
  { emoji: "✨", title: "Creative spark", description: "What if you combined two completely unrelated ideas today?", action: "Inspire me", category: "creative" },
  { emoji: "🎨", title: "Idea generator", description: "A wild prompt to kick-start your imagination.", action: "Give me a prompt", category: "creative" },
  // Goals
  { emoji: "🎯", title: "Project check-in", description: "Review where you left off on your current project.", action: "Show my goals", category: "goals" },
  // Emotions
  { emoji: "💜", title: "How are you feeling?", description: "A gentle check-in to help me support you better.", action: "Let's talk", category: "emotions" },
];

const NEUTRAL_SPARKS: SparkItem[] = [
  { emoji: "🌅", title: "Open question", description: "What's one thing you'd love to explore today?", category: "neutral" },
  { emoji: "💡", title: "Something new", description: "Ask me anything — no topic is off limits!", category: "neutral" },
];

function getDailySpark(enabled: string[]): SparkItem {
  const available = SPARK_POOL.filter((s) => enabled.includes(s.category));
  if (available.length === 0) {
    return NEUTRAL_SPARKS[Math.floor(Math.random() * NEUTRAL_SPARKS.length)];
  }
  // Deterministic daily pick based on day of year
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return available[dayOfYear % available.length];
}

/* ─── Did you know? — fun facts rotating every 3 hours ────────────────────── */

interface FunFact { emoji: string; text: string; category: string; }

const FUN_FACTS: FunFact[] = [
  // Animals
  { emoji: "🐙", text: "Octopuses have three hearts and blue blood. Two pump blood to the gills, while the third pumps it to the rest of the body.", category: "Animal facts" },
  { emoji: "🦩", text: "Flamingos are born white — they turn pink because of the carotenoid pigments in the algae and shrimp they eat.", category: "Animal facts" },
  { emoji: "🐋", text: "Blue whales' hearts are so big that a small child could swim through their arteries.", category: "Animal facts" },
  { emoji: "🦜", text: "Parrots can learn to use words in context, not just mimic them. Some understand abstract concepts like 'same' and 'different'.", category: "Animal facts" },
  { emoji: "🐈", text: "Cats can rotate their ears 180 degrees and have over 20 muscles controlling each ear.", category: "Animal facts" },
  { emoji: "🐝", text: "Bees can recognise human faces using a technique called 'configural processing' — the same method humans use.", category: "Animal facts" },
  { emoji: "🦈", text: "Sharks have been around longer than trees. They've existed for over 400 million years.", category: "Animal facts" },
  { emoji: "🐬", text: "Dolphins sleep with one eye open and half of their brain awake to watch for predators.", category: "Animal facts" },
  { emoji: "🦊", text: "Arctic foxes can survive temperatures as low as -70°C. Their fur changes colour with the seasons.", category: "Animal facts" },
  { emoji: "🐘", text: "Elephants are the only animals that can't jump, but they can communicate using vibrations felt through their feet.", category: "Animal facts" },
  { emoji: "🦉", text: "Owls can't move their eyeballs — that's why they can rotate their heads up to 270 degrees.", category: "Animal facts" },
  { emoji: "🐢", text: "Some turtles can breathe through their bums. It's called cloacal respiration.", category: "Animal facts" },
  { emoji: "🦎", text: "Chameleons don't change colour to blend in — they do it to communicate mood and regulate temperature.", category: "Animal facts" },
  { emoji: "🐧", text: "Emperor penguins can hold their breath for over 20 minutes and dive to depths of 500 metres.", category: "Animal facts" },
  { emoji: "🦋", text: "Butterflies taste with their feet and can see ultraviolet light that humans can't.", category: "Animal facts" },
  { emoji: "🐌", text: "Garden snails can sleep for up to three years at a time if conditions aren't right.", category: "Animal facts" },
  { emoji: "🦑", text: "Giant squid have the largest eyes in the animal kingdom — each one is the size of a dinner plate.", category: "Animal facts" },
  { emoji: "🐸", text: "The golden poison frog has enough venom to kill 10 grown adults, and it's only 5 centimetres long.", category: "Animal facts" },
  { emoji: "🦚", text: "Peacock feathers have no pigment — their colour comes from microscopic crystal-like structures that reflect light.", category: "Animal facts" },
  { emoji: "🐺", text: "Wolves can hear sounds up to 10 miles away in open terrain and have about 200 million scent cells.", category: "Animal facts" },

  // History
  { emoji: "🌍", text: "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still perfectly edible.", category: "History" },
  { emoji: "📚", text: "The first known novel, 'The Tale of Genji', was written by a Japanese noblewoman named Murasaki Shikibu around the year 1000.", category: "History" },
  { emoji: "🏛️", text: "The Great Wall of China is not actually visible from space with the naked eye — that's a common myth.", category: "History" },
  { emoji: "🗡️", text: "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid of Giza.", category: "History" },
  { emoji: "📮", text: "The world's oldest known postal system was in ancient Persia, around 550 BC, using relay riders on horseback.", category: "History" },
  { emoji: "🏰", text: "Oxford University is older than the Aztec Empire. Teaching began there in 1096, while the Aztecs founded Tenochtitlan in 1325.", category: "History" },
  { emoji: "🎭", text: "Ancient Romans used urine to whiten their teeth. It contains ammonia, which is still used in cleaning products today.", category: "History" },
  { emoji: "⚔️", text: "Vikings never wore horned helmets — that image was invented by costume designers in the 19th century.", category: "History" },
  { emoji: "🏺", text: "Ancient Egyptians used mouldy bread as a wound dressing — accidentally practising an early form of antibiotic treatment.", category: "History" },
  { emoji: "🗽", text: "The Statue of Liberty was originally a dull copper colour and turned green over 20 years through oxidation.", category: "History" },
  { emoji: "📜", text: "The shortest war in history was between Britain and Zanzibar in 1896. It lasted just 38 to 45 minutes.", category: "History" },
  { emoji: "🎪", text: "In the 1800s, people used to keep pineapples as status symbols and would rent them for parties.", category: "History" },

  // Science
  { emoji: "🧠", text: "Your brain uses about 20% of your body's total energy, despite being only 2% of your body weight.", category: "Science" },
  { emoji: "⚡", text: "A bolt of lightning is five times hotter than the surface of the sun, reaching about 30,000 Kelvin.", category: "Science" },
  { emoji: "🔬", text: "Bananas are naturally slightly radioactive because they contain potassium-40.", category: "Science" },
  { emoji: "🎵", text: "Music can literally change your brain. Learning an instrument increases the size of your corpus callosum.", category: "Science" },
  { emoji: "💧", text: "Hot water freezes faster than cold water in certain conditions. This is known as the Mpemba effect.", category: "Science" },
  { emoji: "🧬", text: "Humans share about 60% of their DNA with bananas. Life is more connected than we think.", category: "Science" },
  { emoji: "💎", text: "Diamonds can be made from peanut butter. Scientists have replicated Earth's deep mantle pressure to transform it.", category: "Science" },
  { emoji: "⚛️", text: "If you removed all the empty space from atoms in every human, the entire species would fit inside a sugar cube.", category: "Science" },
  { emoji: "🌡️", text: "Glass is technically not a solid — it's an amorphous solid that flows incredibly slowly over centuries.", category: "Science" },
  { emoji: "🔋", text: "The Baghdad Battery, dating to around 250 BC, may be the earliest known electric cell ever discovered.", category: "Science" },
  { emoji: "🧪", text: "Stomach acid is strong enough to dissolve metal. Your stomach lining replaces itself every three to four days.", category: "Science" },
  { emoji: "🌀", text: "A neutron star is so dense that a teaspoon of its material would weigh about 6 billion tonnes.", category: "Science" },
  { emoji: "🧲", text: "Some metals have 'memory'. Nickel-titanium alloy can be bent and will return to its original shape when heated.", category: "Science" },

  // Space
  { emoji: "🌙", text: "There is no sound in space because there are no air molecules to vibrate and carry sound waves.", category: "Space" },
  { emoji: "🪐", text: "Saturn would float if you could find a bathtub big enough — it's less dense than water.", category: "Space" },
  { emoji: "🌠", text: "There are more stars in the universe than grains of sand on all the beaches on Earth.", category: "Space" },
  { emoji: "☀️", text: "The Sun makes up 99.86% of the total mass of the entire solar system.", category: "Space" },
  { emoji: "🌌", text: "The Milky Way and Andromeda galaxies are on a collision course — they'll merge in about 4.5 billion years.", category: "Space" },
  { emoji: "🚀", text: "A day on Venus is longer than a year on Venus. It takes 243 Earth days to rotate but only 225 to orbit the Sun.", category: "Space" },
  { emoji: "🌑", text: "The Moon is drifting away from Earth at a rate of about 3.8 centimetres per year.", category: "Space" },
  { emoji: "🔭", text: "The observable universe is about 93 billion light-years in diameter, and it's still expanding.", category: "Space" },
  { emoji: "🛸", text: "There's a planet made largely of diamond called 55 Cancri e, about 40 light-years from Earth.", category: "Space" },
  { emoji: "🌐", text: "Astronauts experience 16 sunrises and sunsets every day aboard the International Space Station.", category: "Space" },
  { emoji: "💫", text: "The furthest human-made object from Earth is Voyager 1, launched in 1977, now over 24 billion kilometres away.", category: "Space" },

  // Nature
  { emoji: "🌿", text: "Trees communicate underground through a network of fungi called the 'Wood Wide Web', sharing nutrients and warnings.", category: "Nature" },
  { emoji: "🌺", text: "The world's oldest known living tree is over 5,000 years old — a bristlecone pine in California called Methuselah.", category: "Nature" },
  { emoji: "🌊", text: "More than 80% of the ocean remains unexplored and unmapped.", category: "Nature" },
  { emoji: "🏔️", text: "Mount Everest grows about 4 millimetres taller every year due to tectonic activity.", category: "Nature" },
  { emoji: "🌋", text: "There are more than 1,500 potentially active volcanoes on Earth, excluding the ones beneath the ocean.", category: "Nature" },
  { emoji: "🌳", text: "The Amazon rainforest produces about 20% of the world's oxygen and is home to roughly 10% of all known species.", category: "Nature" },
  { emoji: "❄️", text: "No two snowflakes are exactly alike. Each one can contain up to 200 ice crystals in unique patterns.", category: "Nature" },
  { emoji: "🌸", text: "Bamboo is the fastest-growing plant on Earth — some species grow up to 91 centimetres in a single day.", category: "Nature" },
  { emoji: "🍄", text: "The largest living organism on Earth is a honey fungus in Oregon spanning over 9 square kilometres.", category: "Nature" },
  { emoji: "🌏", text: "Earth's core is as hot as the surface of the Sun — about 5,500 degrees Celsius.", category: "Nature" },
  { emoji: "🌈", text: "Rainbows are actually full circles, but we only see half because the ground gets in the way.", category: "Nature" },
  { emoji: "🏝️", text: "There's an underwater waterfall near Mauritius. It's an optical illusion caused by sand and silt flowing off the ocean shelf.", category: "Nature" },

  // Food
  { emoji: "🍫", text: "Chocolate was used as currency by the Aztecs. A single cacao bean could buy a tamale.", category: "Food" },
  { emoji: "☕", text: "Coffee was discovered when Ethiopian goats started dancing after eating coffee berries.", category: "Food" },
  { emoji: "🍯", text: "The inventor of the Pringles can was buried in one — his family honoured his wishes.", category: "Fun fact" },
  { emoji: "🥕", text: "Carrots were originally purple, not orange. The orange variety was bred in the Netherlands in the 17th century.", category: "Food" },
  { emoji: "🍕", text: "The world's most expensive pizza costs over £8,000 and is topped with lobster, caviar, and edible gold.", category: "Food" },
  { emoji: "🧀", text: "Cheddar cheese is naturally white. The orange colour comes from annatto, a plant-based dye.", category: "Food" },
  { emoji: "🍎", text: "Apples float in water because they are 25% air, making them less dense than water.", category: "Food" },
  { emoji: "🫐", text: "Blueberries don't ripen after they are picked. They're one of the only fruits that must ripen on the plant.", category: "Food" },
  { emoji: "🍌", text: "A cluster of bananas is called a 'hand', and a single banana is called a 'finger'.", category: "Food" },
  { emoji: "🌶️", text: "The spiciness of chilli peppers evolved to discourage mammals — birds can't taste the heat at all.", category: "Food" },

  // Human Body
  { emoji: "👁️", text: "Your eyes can distinguish about 10 million different colours.", category: "Human body" },
  { emoji: "🦴", text: "Babies are born with about 300 bones, but adults only have 206 because many fuse together.", category: "Human body" },
  { emoji: "💪", text: "The strongest muscle in your body relative to its size is the masseter — your jaw muscle.", category: "Human body" },
  { emoji: "🫁", text: "If you unfolded your lungs flat, they would cover an entire tennis court.", category: "Human body" },
  { emoji: "🩸", text: "Your body contains about 100,000 kilometres of blood vessels — enough to circle the Earth 2.5 times.", category: "Human body" },
  { emoji: "👃", text: "Your nose can distinguish over 1 trillion different scents.", category: "Human body" },
  { emoji: "🧠", text: "The brain generates enough electricity to power a small light bulb — about 12–25 watts.", category: "Human body" },
  { emoji: "💀", text: "The hyoid bone in your throat is the only bone in your body that isn't connected to any other bone.", category: "Human body" },

  // Language
  { emoji: "📖", text: "The dot over the letters 'i' and 'j' is called a 'tittle'.", category: "Language" },
  { emoji: "🔤", text: "The sentence 'The quick brown fox jumps over the lazy dog' uses every letter of the alphabet.", category: "Language" },
  { emoji: "💬", text: "There are over 7,000 languages spoken worldwide, but nearly half are expected to disappear by 2100.", category: "Language" },
  { emoji: "✍️", text: "'Bookkeeper' is the only English word with three consecutive double letters.", category: "Language" },
  { emoji: "🗣️", text: "The word 'set' has the most definitions of any English word — over 430 different meanings.", category: "Language" },
  { emoji: "📝", text: "Shakespeare invented over 1,700 words we still use today, including 'eyeball', 'lonely', and 'assassination'.", category: "Language" },

  // Music
  { emoji: "🎹", text: "Mozart composed his first piece of music at the age of five and his first symphony at eight.", category: "Music" },
  { emoji: "🎸", text: "The world's longest concert lasted 639 hours and was performed by multiple musicians in shifts.", category: "Music" },
  { emoji: "🎶", text: "Listening to music releases dopamine in the brain — the same chemical triggered by eating food or falling in love.", category: "Music" },
  { emoji: "🥁", text: "The didgeridoo, an Aboriginal Australian instrument, is one of the oldest known instruments at over 1,500 years old.", category: "Music" },

  // Geography
  { emoji: "🗺️", text: "Russia has 11 time zones — more than any other country in the world.", category: "Geography" },
  { emoji: "🏜️", text: "Antarctica is technically the world's largest desert. A desert is defined by low precipitation, not heat.", category: "Geography" },
  { emoji: "🌊", text: "The Dead Sea is so salty that you float without trying. It's about 9.6 times saltier than the ocean.", category: "Geography" },
  { emoji: "🗻", text: "Mauna Kea in Hawaii is taller than Everest when measured from its base on the ocean floor — over 10,000 metres.", category: "Geography" },
  { emoji: "🏞️", text: "Canada has more lakes than the rest of the world combined — over 2 million.", category: "Geography" },
  { emoji: "🌐", text: "The shortest place name in the world is 'Å', a village in Norway meaning 'river'.", category: "Geography" },

  // Technology
  { emoji: "💻", text: "The first computer bug was an actual bug — a moth found inside a Harvard Mark II computer in 1947.", category: "Technology" },
  { emoji: "📱", text: "The first text message ever sent was 'Merry Christmas' in 1992 by Neil Papworth.", category: "Technology" },
  { emoji: "🤖", text: "The word 'robot' comes from the Czech word 'robota', meaning forced labour or drudgery.", category: "Technology" },
  { emoji: "🌐", text: "The first website ever created is still online. It was built by Tim Berners-Lee in 1991.", category: "Technology" },
  { emoji: "🎮", text: "The game Tetris was invented in 1984 by Soviet software engineer Alexey Pajitnov.", category: "Technology" },

  // Miscellaneous
  { emoji: "🎈", text: "The colour orange was named after the fruit, not the other way around.", category: "Fun fact" },
  { emoji: "🧸", text: "The teddy bear was named after US President Theodore 'Teddy' Roosevelt after he refused to shoot a captive bear.", category: "Fun fact" },
  { emoji: "🎩", text: "A group of flamingos is called a 'flamboyance', and a group of crows is called a 'murder'.", category: "Fun fact" },
  { emoji: "🃏", text: "A standard deck of cards can be shuffled into more combinations than there are atoms on Earth.", category: "Fun fact" },
  { emoji: "🧊", text: "There is enough water in Lake Superior to cover all of North and South America in a foot of water.", category: "Fun fact" },
];

function getCurrentFact(): FunFact {
  // Rotate every 3 hours, never repeat until all facts have been shown
  // TODO: Replace with API call (e.g. uselessfacts.jsph.pl or custom endpoint)
  //       so facts are truly infinite and always fresh.
  const SEEN_KEY = "fun-facts-seen";
  const WINDOW_KEY = "fun-facts-window";

  const fiveHourWindow = Math.floor(Date.now() / (5 * 60 * 60 * 1000));

  // Check if we're still in the same 5-hour window
  try {
    const lastWindow = parseInt(localStorage.getItem(WINDOW_KEY) ?? "0", 10);
    if (lastWindow === fiveHourWindow) {
      // Same window — return the fact we already picked
      const lastIdx = parseInt(localStorage.getItem("fun-facts-current") ?? "0", 10);
      return FUN_FACTS[lastIdx % FUN_FACTS.length];
    }
  } catch { /* ignore */ }

  // New window — pick a fresh unseen fact
  let seen: number[] = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"); } catch { /* ignore */ }

  // If all facts seen, reset
  if (seen.length >= FUN_FACTS.length) seen = [];

  // Pick a random unseen index (seeded by window for determinism)
  const unseen = FUN_FACTS.map((_, i) => i).filter((i) => !seen.includes(i));
  const pick = unseen[fiveHourWindow % unseen.length];

  // Save state
  seen.push(pick);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    localStorage.setItem(WINDOW_KEY, String(fiveHourWindow));
    localStorage.setItem("fun-facts-current", String(pick));
  } catch { /* ignore */ }

  return FUN_FACTS[pick];
}

/* ─── Memory Lane helpers ─────────────────────────────────────────────────── */

interface MemoryLaneItem {
  emoji: string;
  text: string;
  timeAgo: string;
}

function getMemoryLane(): MemoryLaneItem[] {
  try {
    const boards = getBoards();
    return boards
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map((b: any) => {
        const ago = getTimeAgo(new Date(b.createdAt));
        return {
          emoji: b.characterEmoji || "💬",
          text: b.title || "A conversation",
          timeAgo: ago,
        };
      });
  } catch {
    return [];
  }
}

function getTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

const Index = () => {
  const navigate = useNavigate();
  const [selectedChar, setSelectedChar] = useState("noe");
  const [loadedChar, setLoadedChar] = useState<Character | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  // Load saved character preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("customize-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.character) {
          setSelectedChar(parsed.character);
        }
      }
    } catch (err) {
      console.error("Failed to load character preference:", err);
    }
  }, []);

  // Show consent modal on first visit
  useEffect(() => {
    if (!hasCompletedOnboarding()) {
      setShowConsentModal(true);
    }
  }, []);

  // Get current character
  useEffect(() => {
    setLoadedChar(characters.find((c) => c.id === selectedChar) || null);
  }, [selectedChar]);

  // Build personalised greeting based on tone + time of day
  const buildGreeting = (): string => {
    const name = getUserName();
    let tone = "warm";
    try {
      const saved = localStorage.getItem("customize-settings");
      if (saved) { tone = JSON.parse(saved).tone ?? "warm"; }
    } catch { /* ignore */ }

    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const timeGreeting = hour < 4.5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    switch (tone) {
      case "professional": return name ? `Welcome, ${name}!` : "Welcome!";
      case "direct":       return name ? `${name}, ready when you are!` : "Ready when you are!";
      case "warm":         return name ? `${timeGreeting}, ${name}! ✨` : `${timeGreeting}! ✨`;
      default:             return name ? `Hello, ${name}!` : "Hello!";
    }
  };

  // Tone-aware UI copy for guidance text
  const getToneCopy = () => {
    let tone = "warm";
    try {
      const saved = localStorage.getItem("customize-settings");
      if (saved) { tone = JSON.parse(saved).tone ?? "warm"; }
    } catch { /* ignore */ }

    const copy: Record<string, Record<string, string>> = {
      warm: {
        subtitle: "Pick a companion who feels right for you ✨",
        charTitle: "Your AI Companion",
        charDesc: "Choose someone who matches your vibe",
        modeTitle: "How would you like to connect?",
      },
      professional: {
        subtitle: "Select your assistant and preferred mode",
        charTitle: "Assistant Selection",
        charDesc: "Choose your AI assistant profile",
        modeTitle: "Select Mode",
      },
      direct: {
        subtitle: "Pick your agent, pick your mode, have fun!",
        charTitle: "Agent",
        charDesc: "Pick a character",
        modeTitle: "Pick a mode",
      },
      friendly: {
        subtitle: "Choose your AI companion and start exploring",
        charTitle: "Your AI Companion",
        charDesc: "Select a character personality",
        modeTitle: "Choose a Mode",
      },
    };
    return copy[tone] ?? copy.warm;
  };

  const handleStartChat = (modePath: string) => {
    // Save character preference before navigating
    try {
      const settings = localStorage.getItem("customize-settings");
      const parsed = settings ? JSON.parse(settings) : {};
      parsed.character = selectedChar;
      localStorage.setItem("customize-settings", JSON.stringify(parsed));
    } catch (err) {
      console.error("Failed to save character preference:", err);
    }
    navigate(modePath);
  };

  // Dynamic data
  const enabled = enabledCategories();
  const spark = getDailySpark(enabled);
  const currentFact = getCurrentFact();
  const memoryLane = getMemoryLane();
  const perms = getPermissions();

  // Context-aware quick actions
  const quickActions = [
    { label: "Customise Settings", icon: Sparkles, path: "/customize", always: true },
    { label: "Memory Sanctuary", icon: Brain, path: "/memory-sanctuary", always: true },
    isMemoryAllowed("wellness") && { label: "Start a Meditation", icon: Leaf, path: "/chat", always: false },
    isMemoryAllowed("goals") && { label: "Review My Projects", icon: Lightbulb, path: "/canvas", always: false },
    isMemoryAllowed("creative") && { label: "Get Inspired", icon: Sparkles, path: "/chat", always: false },
    isMemoryAllowed("emotions") && { label: "How Am I Feeling?", icon: Heart, path: "/chat", always: false },
    isMemoryAllowed("preferences") && { label: "My Music", icon: Music, path: "/chat", always: false },
  ].filter(Boolean) as { label: string; icon: any; path: string; always: boolean }[];

  return (
    <div className="flex flex-col h-full overflow-y-auto page-home">
      {/* Trust & Memory Consent Modal */}
      <TrustMemoryModal
        show={showConsentModal}
        onComplete={() => setShowConsentModal(false)}
      />

      <header className="px-5 pt-12 pb-6 page-header">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-start justify-between"
        >
          <OrbitWrap planet="earth">
            <GlassContainer variant="dark" size="sm" className="inline-block">
              <h1 className="text-2xl font-bold greeting-shimmer">{buildGreeting()}</h1>
            </GlassContainer>
          </OrbitWrap>
          <FocusButton />
        </motion.div>
      </header>

      <div className="px-5 pb-20 space-y-6">
        {/* Daily Spark Engine */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <Card className="glass overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 text-lg">
                    {spark.emoji}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-foreground">{spark.title}</h3>
                    <p className="text-xs text-foreground/60 mt-0.5 leading-relaxed">{spark.description}</p>
                    {spark.action && (
                      <button
                        onClick={() => navigate("/chat")}
                        className="mt-2 text-xs font-semibold text-foreground hover:text-foreground/80 underline transition-colors"
                      >
                        {spark.action} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="sparkle-divider" />

        {/* Did you know? — rotates every 5 hours */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
        >
          <Card className="glass overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">{currentFact.emoji}</span>
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Did you know?</h3>
                  <p className="text-xs text-foreground/70 leading-relaxed">{currentFact.text}</p>
                  <p className="text-[9px] text-foreground/30 mt-1.5">{currentFact.category}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="sparkle-divider" />

        {/* Memory Lane Carousel */}
        {memoryLane.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="glass overflow-hidden">
              <CardContent className="p-4">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                  Memory Lane
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                  {memoryLane.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3 min-w-[140px] max-w-[160px] shrink-0 bg-foreground/5"
                    >
                      <span className="text-lg">{item.emoji}</span>
                      <p className="text-[11px] text-foreground/70 font-medium mt-1 leading-snug line-clamp-2">
                        {item.text}
                      </p>
                      <p className="text-[9px] text-foreground/35 mt-1">{item.timeAgo}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}



        {/* Context-Aware Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action, i) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={i}
                    onClick={() => navigate(action.path)}
                    variant="outline"
                    className="w-full glass justify-start gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>


      </div>
    </div>
  );
};

export default Index;

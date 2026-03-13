import { motion } from "framer-motion";

export interface Character {
  id: string;
  name: string;
  emoji: string;
  color: string;
  bgClass: string;
  description: string;
  role: string;
}

export const characters: Character[] = [
  {
    id: "noe",
    name: "Noe",
    emoji: "🤖",
    color: "hsl(210, 90%, 58%)",
    bgClass: "from-blue-500/20 to-cyan-500/20",
    description: "Code · Work · Debug",
    role: "Your sharp-minded tech companion for coding, productivity, and problem-solving.",
  },
  {
    id: "flo",
    name: "Flo",
    emoji: "🌺",
    color: "hsl(330, 80%, 62%)",
    bgClass: "from-pink-500/20 to-rose-400/20",
    description: "Admin · Social · Life",
    role: "Organises your life, schedules, and helps you create scroll-stopping social media content.",
  },
  {
    id: "spark",
    name: "Spark",
    emoji: "🔥",
    color: "hsl(25, 95%, 55%)",
    bgClass: "from-orange-500/20 to-yellow-400/20",
    description: "Create · Write · Imagine",
    role: "Your creative muse for writing, brainstorming, art, and ideas that need a spark.",
  },
  {
    id: "luna",
    name: "Luna",
    emoji: "🌙",
    color: "hsl(260, 70%, 65%)",
    bgClass: "from-violet-500/20 to-indigo-500/20",
    description: "Talk · Reflect · Grow",
    role: "A warm, empathetic listener for advice, venting, and finding clarity.",
  },
  {
    id: "eden",
    name: "Eden",
    emoji: "🧭",
    color: "hsl(152, 70%, 48%)",
    bgClass: "from-emerald-500/20 to-teal-500/20",
    description: "Travel · Plans · Explore",
    role: "Plans your perfect trip — from hidden gems to seamless itineraries.",
  },
];

interface CharacterSelectProps {
  selected: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}

const CharacterSelect = ({ selected, onSelect, compact }: CharacterSelectProps) => {
  if (compact) {
    return (
      <div className="flex gap-2">
        {characters.map((char) => {
          const isActive = selected === char.id;
          return (
            <motion.button
              key={char.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => onSelect(char.id)}
              title={`${char.name} — ${char.description}`}
              className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all backdrop-blur-md ${
                isActive
                  ? `bg-primary/25 border-2 border-primary char-glow-${char.id}`
                  : "bg-black/35 border border-white/18 hover:bg-black/50 hover:border-white/30"
              }`}
            >
              <span className="text-xl">{char.emoji}</span>
            </motion.button>
          );
        })}
      </div>
    );
  }

  // Full (non-compact) — pyramid layout: 3 on top, 2 below
  const topRow = characters.slice(0, 3);
  const bottomRow = characters.slice(3);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Top row — 3 characters */}
      <div className="flex gap-3 justify-center">
        {topRow.map((char) => <CharCard key={char.id} char={char} selected={selected} onSelect={onSelect} />)}
      </div>
      {/* Bottom row — 2 characters, centered */}
      <div className="flex gap-3 justify-center">
        {bottomRow.map((char) => <CharCard key={char.id} char={char} selected={selected} onSelect={onSelect} />)}
      </div>
    </div>
  );
};

interface CharCardProps {
  char: Character;
  selected: string;
  onSelect: (id: string) => void;
}

const CharCard = ({ char, selected, onSelect }: CharCardProps) => {
  const isActive = selected === char.id;
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      onClick={() => onSelect(char.id)}
      className={`flex flex-col items-center gap-1 p-3 w-[80px] rounded-2xl transition-all backdrop-blur-md ${
        isActive
          ? `bg-primary/25 border-2 border-primary char-glow-${char.id}`
          : "bg-black/35 border border-white/18 hover:bg-black/50 hover:border-white/30"
      }`}
    >
      <span className="text-2xl">{char.emoji}</span>
      <span className="text-[10px] font-bold text-foreground w-full text-center">
        {char.name}
      </span>
      <span className="text-[9px] font-medium text-foreground/70 w-full text-center leading-tight">
        {char.description}
      </span>
    </motion.button>
  );
};

export default CharacterSelect;

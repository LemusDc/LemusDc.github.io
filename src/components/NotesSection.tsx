import { useState } from "react";
import { noteBlocks, repoBase } from "@/lib/course";
import type { NoteFile } from "@/lib/course";
import { GlassCard } from "./ui/glass-card";
import MotionWrapper from "./MotionWrapper";
import { ChevronDown, FileCode2, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function CodeFile({ file }: { file: NoteFile }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-md border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center text-xs font-mono hover:text-purple-500 transition-colors min-w-0"
          aria-expanded={open}
        >
          <FileCode2 className="h-4 w-4 mr-2 shrink-0" />
          <span className="truncate">{file.name}</span>
          <ChevronDown
            className={`h-4 w-4 ml-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <a
          href={`${repoBase}/blob/main/${file.path}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-xs text-muted-foreground hover:text-purple-500 transition-colors ml-3 shrink-0"
        >
          GitHub <ExternalLink className="h-3 w-3 ml-1" />
        </a>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-x-auto overflow-y-hidden bg-background/60 p-3 text-xs leading-relaxed font-mono"
          >
            <code>{file.code}</code>
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NotesSection() {
  const [active, setActive] = useState(noteBlocks[0].id);
  const block = noteBlocks.find((b) => b.id === active) ?? noteBlocks[0];

  return (
    <section
      id="apuntes"
      className="py-12 bg-gradient-to-b from-muted/10 to-background"
    >
      <div className="container max-w-4xl mx-auto px-6 md:px-4">
        <MotionWrapper>
          <h2 className="text-2xl font-bold mb-2 text-center md:text-left">
            📓 Cuaderno de clase
          </h2>
          <p className="text-sm text-muted-foreground mb-6 text-center md:text-left">
            Lo que fui anotando clase a clase, con el código que escribí.
          </p>
        </MotionWrapper>

        <div className="flex flex-wrap gap-2 mb-6 justify-center md:justify-start" role="tablist">
          {noteBlocks.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={b.id === active}
              onClick={() => setActive(b.id)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-all ${
                b.id === active
                  ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/40 font-medium"
                  : "bg-muted/60 border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {b.emoji} {b.title}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={block.id}
            className="space-y-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {block.sessions.map((s) => (
              <GlassCard key={s.date + s.title} className="p-4" hoverEffect={false}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20 whitespace-nowrap">
                    {s.date}
                  </span>
                  <h3 className="font-medium">{s.title}</h3>
                </div>
                <ul className="list-disc ml-4 space-y-1 text-sm text-muted-foreground">
                  {s.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {s.files?.map((file) => (
                  <CodeFile key={file.path} file={file} />
                ))}
                {s.images && s.images.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {s.images.map((img) => (
                      <figure key={img.src}>
                        <a href={img.src} target="_blank" rel="noopener noreferrer">
                          <img
                            src={img.src}
                            alt={img.caption}
                            loading="lazy"
                            className="w-full rounded-md border border-border/50"
                          />
                        </a>
                        <figcaption className="text-xs text-muted-foreground mt-1">
                          {img.caption}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </GlassCard>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

import { course, learned } from "@/lib/course";
import { GlassCard } from "./ui/glass-card";
import MotionWrapper from "./MotionWrapper";
import { Database } from "lucide-react";

export default function CourseSection() {
  return (
    <section id="curso" className="py-12 bg-gradient-to-b from-background to-muted/10">
      <div className="container max-w-4xl mx-auto px-6 md:px-4">
        <MotionWrapper>
          <h2 className="text-2xl font-bold mb-2 text-center md:text-left">
            📚 {course.name}
          </h2>
          <p className="text-sm text-muted-foreground mb-6 text-center md:text-left">
            {course.university} · {course.period}
          </p>
        </MotionWrapper>

        <MotionWrapper delay={0.1}>
          <GlassCard className="p-5 mb-6" hoverEffect={false}>
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-purple-500/10">
                <Database className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {course.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {course.stack.map((s) => (
                    <span
                      key={s}
                      className="px-3 py-1 bg-muted/80 rounded-md text-xs border border-purple-500/10"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </MotionWrapper>

        <MotionWrapper delay={0.1}>
          <h3 className="text-lg font-medium mb-3">🎯 Lo aprendido</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {learned.map((block) => (
              <GlassCard key={block.title} className="p-4">
                <h4 className="font-medium mb-2">
                  <span className="mr-2">{block.emoji}</span>
                  {block.title}
                </h4>
                <ul className="list-disc ml-4 space-y-1 text-sm text-muted-foreground">
                  {block.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
        </MotionWrapper>

      </div>
    </section>
  );
}

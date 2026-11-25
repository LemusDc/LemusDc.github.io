import { activities } from "@/lib/course";
import { GlassCard } from "./ui/glass-card";
import MotionWrapper from "./MotionWrapper";
import { CalendarDays } from "lucide-react";

const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function fmt(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${months[m - 1]}`;
}

const kindEmoji: Record<string, string> = {
  portafolio: "🗂️",
  quiz: "⚡",
  taller: "🛠️",
  parcial: "📝",
  proyecto: "🚀",
};

export default function ActivitiesSection() {
  return (
    <section id="cronograma" className="py-12">
      <div className="container max-w-4xl mx-auto px-6 md:px-4">
        <MotionWrapper>
          <h2 className="text-2xl font-bold mb-8 text-center md:text-left">
            🗓️ Actividades del semestre
          </h2>
        </MotionWrapper>

        <div className="relative space-y-4 pl-6 border-l-2 border-purple-500/20">
          {activities.map((a, i) => {
            const sameDay = a.start === a.end;
            return (
              <MotionWrapper key={a.name} delay={Math.min(i * 0.05, 0.3)}>
                <div className="relative">
                  <span className="absolute -left-[31px] top-5 h-3 w-3 rounded-full ring-4 ring-background bg-purple-500" />
                  <GlassCard
                    className={`p-4 ${a.highlight ? "border-purple-500/40" : ""}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm ${a.highlight ? "font-semibold" : "font-medium"}`}>
                          {kindEmoji[a.kind]} {a.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center">
                            <CalendarDays className="h-3.5 w-3.5 mr-1" />
                            {sameDay ? fmt(a.start) : `${fmt(a.start)} → ${fmt(a.end)}`}
                          </span>
                          <span>{a.type}</span>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </MotionWrapper>
            );
          })}
        </div>
      </div>
    </section>
  );
}

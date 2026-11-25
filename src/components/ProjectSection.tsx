import { project, repoBase } from "@/lib/course";
import { GlassCard } from "./ui/glass-card";
import MotionWrapper from "./MotionWrapper";
import { FileText, Github, Youtube } from "lucide-react";

const tree = `${repoBase}/tree/main/bd2/proyecto`;
const blob = `${repoBase}/blob/main/bd2/proyecto/docs`;

export default function ProjectSection() {
  return (
    <section id="proyecto" className="py-12 bg-gradient-to-b from-background to-muted/10">
      <div className="container max-w-4xl mx-auto px-6 md:px-4">
        <MotionWrapper>
          <h2 className="text-2xl font-bold mb-2 text-center md:text-left">
            🚀 Proyecto integrador · {project.name}
          </h2>
          <p className="text-sm text-muted-foreground mb-6 text-center md:text-left">
            {project.subtitle} · {project.team}
          </p>
        </MotionWrapper>

        <MotionWrapper delay={0.1}>
          <GlassCard className="p-5 mb-6" hoverEffect={false}>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {project.description}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {project.stack.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1 bg-muted/80 rounded-md text-xs border border-purple-500/10"
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-5 text-sm">
              <a
                href={tree}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-muted-foreground hover:text-purple-500 transition-colors"
              >
                <Github className="h-4 w-4 mr-2" /> Código en GitHub
              </a>
              <a
                href={project.video}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-muted-foreground hover:text-purple-500 transition-colors"
              >
                <Youtube className="h-4 w-4 mr-2" /> Video del proyecto
              </a>
            </div>
          </GlassCard>
        </MotionWrapper>

        <MotionWrapper delay={0.1}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {project.highlights.map((h) => (
              <GlassCard key={h.label} className="p-4 text-center">
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {h.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{h.label}</p>
              </GlassCard>
            ))}
          </div>
        </MotionWrapper>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MotionWrapper delay={0.1}>
            <GlassCard className="p-4 h-full">
              <h3 className="font-medium mb-2">✨ Qué incluye</h3>
              <ul className="list-disc ml-4 space-y-1 text-sm text-muted-foreground">
                {project.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </GlassCard>
          </MotionWrapper>

          <MotionWrapper delay={0.2}>
            <GlassCard className="p-4 h-full">
              <h3 className="font-medium mb-2">📄 Documentación</h3>
              <ul className="space-y-1.5 text-sm">
                {project.docs.map(([file, label]) => (
                  <li key={file}>
                    <a
                      href={`${blob}/${file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-muted-foreground hover:text-purple-500 transition-colors"
                    >
                      <FileText className="h-4 w-4 mr-2 shrink-0" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </MotionWrapper>
        </div>
      </div>
    </section>
  );
}

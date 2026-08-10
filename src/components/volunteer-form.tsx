"use client";

import { Check, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_META,
  CONTACT_CHANNEL_LABELS,
  CONTACT_CHANNELS,
  type ContactChannel,
  categoryMeta,
  DEPARTAMENTO_NAMES,
  MAX_VOLUNTEER_CAPACITY,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full border border-border bg-background px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring";

const CAPACITY_OPTIONS = [1, 2, 3, 5, MAX_VOLUNTEER_CAPACITY];

export function VolunteerForm() {
  // Capabilities reuse the report taxonomy, so an offer and a need speak the
  // same vocabulary. Free-text labels are allowed for anything not listed yet.
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [customCap, setCustomCap] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");
  const [contactChannel, setContactChannel] =
    useState<ContactChannel>("whatsapp");
  const [contact, setContact] = useState("");
  // Deliberately unchecked: a pre-ticked consent box isn't consent (Ley 1581).
  const [contactConsent, setContactConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [folio, setFolio] = useState<string | null>(null);

  function toggleCapability(c: string) {
    setCapabilities((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function addCustom() {
    const label = customCap.trim();
    if (!label) return;
    if (label.length > 40) {
      toast.error("Esa capacidad es muy larga.");
      return;
    }
    const exists = capabilities.some(
      (c) => c.toLowerCase() === label.toLowerCase(),
    );
    if (!exists) setCapabilities((prev) => [...prev, label]);
    setCustomCap("");
  }

  async function submit() {
    if (capabilities.length === 0) {
      toast.error("Elige al menos una forma de ayudar.");
      return;
    }
    if (!departamento) {
      toast.error("Selecciona tu departamento.");
      return;
    }
    if (contact.trim().length < 5) {
      toast.error("Déjanos un contacto para poder ubicarte.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/volunteers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          capabilities,
          departamento,
          municipio: municipio.trim() || undefined,
          capacity,
          displayName: displayName.trim() || undefined,
          notes: notes.trim() || undefined,
          contactChannel,
          contact: contact.trim(),
          contactConsent,
        }),
      });
      if (!res.ok) throw new Error("submit failed");
      const { id } = (await res.json()) as { id: string };
      setFolio(id);
    } catch {
      toast.error("No se pudo enviar. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (folio) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader
          right={
            <Button asChild size="sm" variant="ghost">
              <Link href="/">Ver mapa</Link>
            </Button>
          }
        />
        <main className="flex flex-1 items-center justify-center p-0 sm:p-4">
          <div className="w-full border-y border-border bg-card sm:max-w-[420px] sm:border">
            <div className="flex flex-col items-center gap-4 border-b border-border px-6 py-8 text-center">
              <div className="flex size-11 items-center justify-center border border-emerald-500/40 text-emerald-500">
                <Check className="size-5" />
              </div>
              <div className="space-y-1">
                <h1 className="text-[18px] font-medium tracking-tight">
                  Quedaste registrado
                </h1>
                <p className="text-[13px] text-muted-foreground">
                  Gracias por ponerte a disposición.
                </p>
              </div>
              <div className="flex items-center gap-2 border border-border bg-background px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Folio
                </span>
                <span className="font-mono text-sm font-medium tracking-tight">
                  {folio}
                </span>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {contactConsent
                  ? "Guardamos tu contacto solo para avisarte cuando haya un caso que puedas atender. Nunca aparece en el mapa ni se comparte públicamente."
                  : "No guardamos tu contacto, así que nadie te va a escribir. Puedes revisar las necesidades publicadas cuando quieras."}
              </p>
            </div>
            <div className="flex gap-2 border-t border-border p-4">
              <Button asChild className="flex-1">
                <Link href="/ayudar/necesidades">Ver necesidades</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <Button asChild size="sm" variant="ghost">
            <Link href="/">Ver mapa</Link>
          </Button>
        }
      />
      <main className="flex flex-1 flex-col p-0 sm:items-center sm:justify-center sm:p-4">
        <div className="flex w-full flex-1 flex-col border-border bg-card sm:max-w-[460px] sm:flex-none sm:border">
          <div className="border-b border-border px-5 py-5 sm:px-6">
            <h1 className="text-[19px] font-semibold tracking-tight sm:text-[18px]">
              Quiero ayudar
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Cuéntanos qué puedes aportar y dónde estás. Con eso podemos
              cruzarte con las necesidades que ya están verificadas.
            </p>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:space-y-5 sm:px-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  ¿Con qué puedes ayudar?
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  Puedes elegir varias
                </span>
              </div>
              <div className="grid grid-cols-2 gap-px border border-border bg-border">
                {CATEGORIES.map((c) => {
                  const on = capabilities.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCapability(c)}
                      className={cn(
                        "flex min-h-12 items-center gap-2 px-3 py-2.5 text-left text-[13px] transition-colors",
                        on
                          ? "bg-secondary text-foreground"
                          : "bg-card text-muted-foreground hover:bg-accent active:bg-accent",
                      )}
                    >
                      <span
                        className="size-2.5 shrink-0 border border-black/10"
                        style={{
                          backgroundColor: CATEGORY_META[c].color,
                          opacity: on ? 1 : 0.5,
                        }}
                      />
                      <span className="flex-1">{CATEGORY_LABELS[c]}</span>
                      {on ? <Check className="size-3.5" /> : null}
                    </button>
                  );
                })}
              </div>

              {/* Anything the taxonomy doesn't cover yet (e.g. "transporte 4x4",
                  "traducción a emberá") — moderators reconcile these later. */}
              <div className="flex items-center gap-px border border-border bg-border">
                <input
                  value={customCap}
                  onChange={(e) => setCustomCap(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                  placeholder="¿Otra cosa? Escríbela y añádela"
                  maxLength={40}
                  className="h-11 flex-1 bg-card px-3 text-[13px] outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={addCustom}
                  className="flex h-11 items-center gap-1 bg-card px-3 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                  Añadir
                </button>
              </div>

              {capabilities.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {capabilities.map((c) => {
                    const meta = categoryMeta(c);
                    const label =
                      CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c;
                    return (
                      <span
                        key={c}
                        className="flex items-center gap-1.5 border border-border bg-background py-1 pl-2 pr-1 text-[12px]"
                      >
                        <span
                          className="size-2 shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        {label}
                        <button
                          type="button"
                          onClick={() => toggleCapability(c)}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={`Quitar ${label}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Departamento
              </span>
              <Select value={departamento} onValueChange={setDepartamento}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="¿Desde dónde puedes ayudar?" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTAMENTO_NAMES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                placeholder="Municipio (opcional)"
                maxLength={120}
                className={inputClass}
              />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                No te pedimos tu dirección ni tu ubicación exacta. Con el
                departamento y el municipio basta para ubicarte cerca.
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                ¿Cuántos casos a la vez?
              </span>
              <div className="grid grid-cols-5 gap-px border border-border bg-border">
                {CAPACITY_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCapacity(n)}
                    className={cn(
                      "min-h-11 text-[13px] transition-colors",
                      capacity === n
                        ? "bg-secondary text-foreground"
                        : "bg-card text-muted-foreground hover:bg-accent active:bg-accent",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                ¿Cómo te ubicamos?
              </span>
              <div className="grid grid-cols-2 gap-px border border-border bg-border">
                {CONTACT_CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setContactChannel(ch)}
                    className={cn(
                      "min-h-11 text-[13px] transition-colors",
                      contactChannel === ch
                        ? "bg-secondary text-foreground"
                        : "bg-card text-muted-foreground hover:bg-accent active:bg-accent",
                    )}
                  >
                    {CONTACT_CHANNEL_LABELS[ch]}
                  </button>
                ))}
              </div>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                inputMode={contactChannel === "whatsapp" ? "tel" : "email"}
                placeholder={
                  contactChannel === "whatsapp"
                    ? "300 123 4567"
                    : "tucorreo@ejemplo.com"
                }
                maxLength={120}
                className={inputClass}
              />

              {/* Opt-in. Unchecked, the server keeps only the hash: enough to
                  recognize a repeat sign-up, not enough to reach anyone. */}
              <button
                type="button"
                onClick={() => setContactConsent((v) => !v)}
                aria-pressed={contactConsent}
                className={cn(
                  "flex w-full items-start gap-2.5 border p-3 text-left transition-colors",
                  contactConsent
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-border bg-background hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "mt-px flex size-4 shrink-0 items-center justify-center border",
                    contactConsent
                      ? "border-emerald-500/60 text-emerald-500"
                      : "border-border text-transparent",
                  )}
                >
                  <Check className="size-3" />
                </span>
                <span className="flex-1 text-[13px] leading-relaxed">
                  Guarden mi contacto para avisarme cuando haya un caso que
                  pueda atender.
                  <span className="mt-1 block text-[12px] text-muted-foreground">
                    Si lo dejas sin marcar te registramos igual y puedes ver las
                    necesidades, pero nadie va a escribirte.
                  </span>
                </span>
              </button>
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Algo más (opcional)
              </span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Cómo quieres que te llamemos"
                maxLength={60}
                className={inputClass}
              />
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: tengo camioneta y disponibilidad los fines de semana. Soy enfermera."
                rows={3}
                maxLength={500}
                className="resize-none"
              />
            </div>

            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Registrarte no te da acceso a datos de las personas que reportan.
              Las necesidades que vas a ver son las mismas que ya están en el
              mapa público, sin datos personales y con ubicación aproximada.
            </p>
          </div>

          <div className="sticky bottom-0 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              className="h-11 w-full text-[15px]"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "Enviando…" : "Registrarme"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

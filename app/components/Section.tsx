"use client";

export default function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 mt-6">
      <h3 className="text-[10px] font-semibold tracking-[0.1em] uppercase text-ink-secondary mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

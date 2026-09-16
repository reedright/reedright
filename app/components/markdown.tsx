import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Hunk } from "~/lib/brain/diff";

/** Renders untrusted markdown safely: react-markdown emits React elements and drops raw HTML. */
export function MarkdownView({ source }: { source: string }) {
  return (
    <div className="markdown">
      <Markdown remarkPlugins={[remarkGfm]} components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" /> }}>
        {source}
      </Markdown>
    </div>
  );
}

const rowStyle = {
  add: "bg-green-50 text-green-900 dark:bg-green-950/60 dark:text-green-200",
  del: "bg-red-50 text-red-900 dark:bg-red-950/60 dark:text-red-200",
  context: "",
} as const;

/** Inline unified diff, GitHub style: old and new line numbers, then the line with its +/- marker. */
export function DiffView({ hunks }: { hunks: Hunk[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-stone-200 font-mono text-xs leading-5 dark:border-stone-800">
      <table className="w-full border-collapse">
        <tbody>
          {hunks.map((h, i) => (
            <HunkRows key={i} hunk={h} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HunkRows({ hunk }: { hunk: Hunk }) {
  return (
    <>
      <tr className="bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
        <td colSpan={3} className="px-3 py-1 whitespace-pre">{hunk.header}</td>
      </tr>
      {hunk.lines.map((l, i) => (
        <tr key={i} className={rowStyle[l.kind]}>
          <td className="w-10 select-none border-r border-stone-100 px-2 text-right text-stone-400 dark:border-stone-800">{l.oldNo ?? ""}</td>
          <td className="w-10 select-none border-r border-stone-100 px-2 text-right text-stone-400 dark:border-stone-800">{l.newNo ?? ""}</td>
          <td className="px-3 whitespace-pre-wrap break-all">
            <span className="mr-2 inline-block w-3 select-none text-stone-400">{l.kind === "add" ? "+" : l.kind === "del" ? "-" : " "}</span>
            {l.text}
          </td>
        </tr>
      ))}
    </>
  );
}

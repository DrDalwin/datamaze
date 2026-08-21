export function LoadingOverlay({
  text,
  error,
}: {
  text: string;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 bg-black/95 text-white flex flex-col items-center justify-center gap-3 z-[10000]">
      <div className="text-2xl font-bold">📖 DATAMAZE</div>
      {!error ? (
        <div className="text-[14px] text-[#aaa] text-center px-[20px]">{text}</div>
      ) : (
        <div
          className="w-[min(750px,90vw)] p-[25px] text-center text-[#ff7777] leading-[1.6] bg-[#28000059] border border-[#ff64644d] rounded-lg"
          dangerouslySetInnerHTML={{ __html: error }}
        />
      )}
    </div>
  );
}

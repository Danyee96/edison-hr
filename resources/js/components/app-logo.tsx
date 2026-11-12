export default function AppLogo({ position }: { position: 'left' | 'right' }) {
    return (
        <div className={`flex w-full items-center gap-3 ${position === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
            <img
                src="/images/logos/galaxy-logo-white.png"
                alt="Edison Energy"
                className="h-14 w-auto max-w-[230px] object-contain"
            />
            <span className="hidden size-5 shrink-0 rounded-full border-2 border-white/70 md:block" />
        </div>
    );
}

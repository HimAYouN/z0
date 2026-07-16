export default function AuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>){
    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-50 px-4 py-16 dark:bg-black">
            {children}
        </div>
    )
}
export default function DashboardLoading() {
  return (
    <div className="max-w-[1440px] mx-auto space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 card-shadow h-36" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 h-64" />
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 h-64" />
      </div>
      <div className="bg-white rounded-2xl h-48" />
    </div>
  )
}

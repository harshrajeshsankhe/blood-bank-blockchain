import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

export function TempChart({ readings }: { readings: any[] }) {
  const data = [...readings].reverse().map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString(),
    temperature: Number(r.temperature_c)
  }));

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={[0, 10]} />
          <Tooltip />
          <Line type="monotone" dataKey="temperature" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

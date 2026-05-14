// app/dashboard/components/PerformanceChart.tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Mon', users: 400, tickets: 240 },
  { name: 'Tue', users: 300, tickets: 139 },
  { name: 'Wed', users: 500, tickets: 280 },
  { name: 'Thu', users: 280, tickets: 190 },
  { name: 'Fri', users: 590, tickets: 380 },
  { name: 'Sat', users: 350, tickets: 210 },
  { name: 'Sun', users: 400, tickets: 250 },
];

export default function PerformanceChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="users" stroke="#B8112D" strokeWidth={2} />
        <Line type="monotone" dataKey="tickets" stroke="#3B82F6" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
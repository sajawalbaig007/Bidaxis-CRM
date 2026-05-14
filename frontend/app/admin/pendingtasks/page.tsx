"use client";

import { useState } from "react";
import { Clock, AlertCircle, Calendar } from "lucide-react";
import toast from "react-hot-toast";

type Task = {
  id: number;
  task: string;
  priority: "High" | "Medium" | "Low";
  due: string;
  completed: boolean;
};

const initialTasks: Task[] = [
  { id: 1, task: "Review pending user approvals (12 new)", priority: "High", due: "Today", completed: false },
  { id: 2, task: "Update system documentation", priority: "Medium", due: "Tomorrow", completed: false },
  { id: 3, task: "Schedule team meeting for Q4 planning", priority: "Medium", due: "This week", completed: false },
  { id: 4, task: "Backup database", priority: "Low", due: "Friday", completed: true },
];

const getPriorityStyles = (priority: string) => {
  switch(priority) {
    case "High": return "bg-red-100 text-red-600";
    case "Medium": return "bg-yellow-100 text-yellow-600";
    case "Low": return "bg-green-100 text-green-600";
    default: return "bg-gray-100 text-gray-600";
  }
};

export default function PendingTasks() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const pendingCount = tasks.filter(t => !t.completed).length;

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
    toast.success("Task status updated");
  };

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800"> Pending Tasks</h3>
        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
          {pendingCount} pending
        </span>
      </div>
      
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {tasks.map((task) => (
          <div 
            key={task.id} 
            className={`flex items-start gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all ${
              task.completed ? "opacity-60" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(task.id)}
              className="w-4 h-4 rounded border-gray-300 mt-0.5 cursor-pointer"
            />
            <div className="flex-1">
              <p className={`text-sm ${task.completed ? "line-through text-gray-400" : "text-gray-800"}`}>
                {task.task}
              </p>
              <div className="flex gap-2 mt-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityStyles(task.priority)}`}>
                  {task.priority}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={10} /> Due: {task.due}
                </span>
              </div>
            </div>
            <AlertCircle size={14} className="text-gray-300" />
          </div>
        ))}
      </div>
    </div>
  );
}
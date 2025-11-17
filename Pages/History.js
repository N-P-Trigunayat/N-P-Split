import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, DollarSign, Calendar, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const categoryColors = {
  food: "bg-orange-100 text-orange-800 border-orange-200",
  transportation: "bg-blue-100 text-blue-800 border-blue-200",
  entertainment: "bg-purple-100 text-purple-800 border-purple-200",
  accommodation: "bg-pink-100 text-pink-800 border-pink-200",
  utilities: "bg-green-100 text-green-800 border-green-200",
  shopping: "bg-yellow-100 text-yellow-800 border-yellow-200",
  other: "bg-slate-100 text-slate-800 border-slate-200"
};

export default function History() {
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date'),
    initialData: [],
  });

  const { data: settlements, isLoading: loadingSettlements } = useQuery({
    queryKey: ['settlements'],
    queryFn: () => base44.entities.Settlement.list('-created_date'),
    initialData: [],
  });

  const allActivity = [
    ...expenses.map(e => ({ ...e, type: 'expense' })),
    ...settlements.map(s => ({ ...s, type: 'settlement' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredActivity = filter === "all"
    ? allActivity
    : filter === "expenses"
    ? allActivity.filter(a => a.type === 'expense')
    : allActivity.filter(a => a.type === 'settlement');

  const isLoading = loadingExpenses || loadingSettlements;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Activity History</h1>
          <p className="text-slate-500 mt-1">View all your expenses and settlements</p>
        </div>

        <div className="mb-6">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="bg-white border border-slate-200">
              <TabsTrigger value="all">All Activity</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="settlements">Settlements</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="shadow-lg border-slate-200">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredActivity.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Receipt className="w-10 h-10 text-slate-400" />
                </div>
                <p className="text-slate-500 text-lg font-medium">No activity yet</p>
                <p className="text-slate-400 text-sm mt-1">Start by adding an expense</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredActivity.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-4 p-5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      item.type === 'expense' 
                        ? 'bg-gradient-to-br from-emerald-100 to-teal-100' 
                        : 'bg-gradient-to-br from-blue-100 to-cyan-100'
                    }`}>
                      {item.type === 'expense' ? (
                        <Receipt className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <DollarSign className="w-6 h-6 text-blue-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 text-lg truncate">
                            {item.type === 'expense' ? item.description : 'Payment Settlement'}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                            <User className="w-4 h-4" />
                            {item.type === 'expense' ? (
                              <span>
                                {item.paid_by === user?.email ? 'You' : item.paid_by} paid • split {item.split_with.length} ways
                              </span>
                            ) : (
                              <span>
                                {item.from_user === user?.email ? 'You' : item.from_user} paid{' '}
                                {item.to_user === user?.email ? 'you' : item.to_user}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-900">
                            ${item.amount.toFixed(2)}
                          </p>
                          {item.type === 'expense' && (
                            <p className="text-xs text-slate-500 mt-1">
                              ${(item.amount / item.split_with.length).toFixed(2)} each
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {item.type === 'expense' && (
                          <Badge
                            variant="secondary"
                            className={`${categoryColors[item.category]} border text-xs font-medium`}
                          >
                            {item.category}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(item.date), 'MMMM d, yyyy')}
                        </div>
                      </div>

                      {item.type === 'settlement' && item.note && (
                        <p className="text-sm text-slate-500 mt-2 italic">{item.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
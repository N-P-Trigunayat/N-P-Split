import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, DollarSign, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const categoryColors = {
  food: "bg-orange-100 text-orange-800 border-orange-200",
  transportation: "bg-blue-100 text-blue-800 border-blue-200",
  entertainment: "bg-purple-100 text-purple-800 border-purple-200",
  accommodation: "bg-pink-100 text-pink-800 border-pink-200",
  utilities: "bg-green-100 text-green-800 border-green-200",
  shopping: "bg-yellow-100 text-yellow-800 border-yellow-200",
  groceries: "bg-lime-100 text-lime-800 border-lime-200",
  healthcare: "bg-red-100 text-red-800 border-red-200",
  other: "bg-slate-100 text-slate-800 border-slate-200"
};

export default function RecentActivity({ expenses, settlements, isLoading, currentUserEmail, currencySymbol = "$" }) {
  const allActivity = [
    ...expenses.map(e => ({ ...e, type: 'expense' })),
    ...settlements.map(s => ({ ...s, type: 'settlement' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="text-lg font-semibold text-slate-900">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : allActivity.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">No activity yet</p>
            <p className="text-slate-400 text-xs mt-1">Start by adding an expense</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allActivity.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  item.type === 'expense' ? 'bg-emerald-100' : 'bg-blue-100'
                }`}>
                  {item.type === 'expense' ? (
                    <Receipt className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {item.type === 'expense' ? item.description : 'Settlement'}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {item.type === 'expense' ? (
                          <>
                            {item.payers?.[0]?.email === currentUserEmail || item.payers?.[0] === currentUserEmail ? 'You' : item.payers?.[0]?.email || item.payers?.[0]} paid • split {item.splits?.length || 0} ways
                          </>
                        ) : (
                          <>
                            {item.from_user === currentUserEmail ? 'You' : item.from_user} paid{' '}
                            {item.to_user === currentUserEmail ? 'you' : item.to_user}
                          </>
                        )}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-slate-900">
                      {currencySymbol}{item.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {item.type === 'expense' && (
                      <Badge variant="secondary" className={`${categoryColors[item.category]} border text-xs`}>
                        {item.category}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(item.date), 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
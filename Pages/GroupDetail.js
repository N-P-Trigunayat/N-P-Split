import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, User, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import BalanceCard from "../Components/dashboard/BalanceCard.js";

export default function GroupDetail() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const groupId = urlParams.get('id');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: group, isLoading: loadingGroup } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const groups = await base44.entities.Group.list();
      return groups.find(g => g.id === groupId);
    },
    enabled: !!groupId,
  });

  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ['group-expenses', groupId],
    queryFn: () => base44.entities.Expense.filter({ group_id: groupId }, '-created_date'),
    initialData: [],
    enabled: !!groupId,
  });

  const { data: settlements, isLoading: loadingSettlements } = useQuery({
    queryKey: ['group-settlements', groupId],
    queryFn: () => base44.entities.Settlement.filter({ group_id: groupId }, '-created_date'),
    initialData: [],
    enabled: !!groupId,
  });

  const calculateBalances = () => {
    if (!user?.email) return { youOwe: {}, oweYou: {} };
    
    const balances = {};
    
    expenses.forEach(expense => {
      expense.splits?.forEach(split => {
        const payer = expense.payers?.[0]?.email || expense.payers?.[0];
        if (split.email === payer) return;
        
        if (payer === user.email) {
          balances[split.email] = (balances[split.email] || 0) + split.amount;
        } else if (split.email === user.email) {
          balances[payer] = (balances[payer] || 0) - split.amount;
        }
      });
    });
    
    settlements.forEach(settlement => {
      if (settlement.from_user === user.email) {
        balances[settlement.to_user] = (balances[settlement.to_user] || 0) + settlement.amount;
      } else if (settlement.to_user === user.email) {
        balances[settlement.from_user] = (balances[settlement.from_user] || 0) - settlement.amount;
      }
    });
    
    const youOwe = {};
    const oweYou = {};
    
    Object.entries(balances).forEach(([person, amount]) => {
      if (Math.abs(amount) < 0.01) return;
      if (amount > 0) oweYou[person] = amount;
      else youOwe[person] = Math.abs(amount);
    });
    
    return { youOwe, oweYou };
  };

  const { youOwe, oweYou } = calculateBalances();
  const isLoading = loadingGroup || loadingExpenses || loadingSettlements;

  if (!groupId) {
    return <div className="p-8">Group not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" onClick={() => navigate(createPageUrl("Groups"))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            {isLoading ? (
              <Skeleton className="h-10 w-64" />
            ) : (
              <>
                <h1 className="text-3xl font-bold text-slate-900">{group?.name}</h1>
                {group?.description && <p className="text-slate-500 mt-1">{group.description}</p>}
              </>
            )}
          </div>
          <Button
            onClick={() => navigate(createPageUrl("AddExpense") + `?group_id=${groupId}`)}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Expense
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-500">Members</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-20" />
              ) : (
                <div className="space-y-2">
                  {group?.members?.map(email => (
                    <div key={email} className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{email === user?.email ? 'You' : email}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-500">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">
                ${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
              </p>
              <p className="text-sm text-slate-500 mt-1">{expenses.length} expenses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-500">Your Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${
                Object.values(oweYou).reduce((s, a) => s + a, 0) >= Object.values(youOwe).reduce((s, a) => s + a, 0)
                  ? 'text-emerald-600' : 'text-red-500'
              }`}>
                ${Math.abs(
                  Object.values(oweYou).reduce((s, a) => s + a, 0) - Object.values(youOwe).reduce((s, a) => s + a, 0)
                ).toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <BalanceCard title="You Owe" balances={youOwe} type="owe" isLoading={isLoading} />
          <BalanceCard title="Owed to You" balances={oweYou} type="owed" isLoading={isLoading} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40" />
            ) : expenses.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">No expenses yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.slice(0, 10).map(expense => (
                  <div key={expense.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50">
                    <div>
                      <p className="font-semibold">{expense.description}</p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(expense.date), 'MMM d, yyyy')} • {expense.category}
                      </p>
                    </div>
                    <p className="text-lg font-bold">${expense.amount.toFixed(2)}</p>
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
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, TrendingUp, TrendingDown, DollarSign, Search, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BalanceCard from "../Components/dashboard/BalanceCard.js";
import RecentActivity from "../Components/dashboard/RecentActivity.js/index.js";
import LoadingScreen from "../components/LoadingScreen";

const CURRENCY_SYMBOLS = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "C$", AUD: "A$",
  CHF: "CHF", CNY: "¥", INR: "₹", MXN: "MX$", BRL: "R$", ZAR: "R",
  SGD: "S$", NZD: "NZ$", KRW: "₩", SEK: "kr", NOK: "kr", DKK: "kr",
  PLN: "zł", THB: "฿", IDR: "Rp"
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setTimeout(() => setIsInitialLoading(false), 800);
    }).catch(() => {
      setIsInitialLoading(false);
    });
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

  const getCurrencySymbol = () => {
    const currency = user?.default_currency || "USD";
    return CURRENCY_SYMBOLS[currency] || "$";
  };

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

  const simplifyDebts = () => {
    if (!user?.email) return [];
    
    const balances = {};
    expenses.forEach(expense => {
      expense.splits?.forEach(split => {
        const payer = expense.payers?.[0]?.email || expense.payers?.[0];
        if (split.email !== payer) {
          if (payer === user.email) {
            balances[split.email] = (balances[split.email] || 0) + split.amount;
          } else if (split.email === user.email) {
            balances[payer] = (balances[payer] || 0) - split.amount;
          }
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

    const creditors = [];
    const debtors = [];
    
    Object.entries(balances).forEach(([person, amount]) => {
      if (Math.abs(amount) < 0.01) return;
      if (amount > 0) creditors.push({ person, amount });
      else debtors.push({ person, amount: Math.abs(amount) });
    });

    const simplified = [];
    let i = 0, j = 0;
    
    while (i < creditors.length && j < debtors.length) {
      const settleAmount = Math.min(creditors[i].amount, debtors[j].amount);
      simplified.push({
        from: debtors[j].person,
        to: creditors[i].person,
        amount: settleAmount
      });
      
      creditors[i].amount -= settleAmount;
      debtors[j].amount -= settleAmount;
      
      if (creditors[i].amount === 0) i++;
      if (debtors[j].amount === 0) j++;
    }
    
    return simplified;
  };

  const whoShouldPayNext = () => {
    const balances = {};
    expenses.forEach(expense => {
      expense.splits?.forEach(split => {
        const payer = expense.payers?.[0]?.email || expense.payers?.[0];
        balances[split.email] = (balances[split.email] || 0) + split.amount;
        balances[payer] = (balances[payer] || 0) - split.amount;
      });
    });

    const sortedBalances = Object.entries(balances)
      .filter(([email]) => email !== user?.email)
      .sort(([, a], [, b]) => b - a);
    
    return sortedBalances[0]?.[0] || null;
  };

  const { youOwe, oweYou } = calculateBalances();
  const totalYouOwe = Object.values(youOwe).reduce((sum, amt) => sum + amt, 0);
  const totalOweYou = Object.values(oweYou).reduce((sum, amt) => sum + amt, 0);
  const netBalance = totalOweYou - totalYouOwe;
  const simplifiedTransactions = simplifyDebts();
  const nextPayer = whoShouldPayNext();

  const filteredExpenses = expenses.filter(exp =>
    exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = loadingExpenses || loadingSettlements;
  const currencySymbol = getCurrencySymbol();

  if (isInitialLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
              Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-slate-500 mt-1">Here's your expense overview</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Link to={createPageUrl("AddExpense")} className="flex-1 md:flex-none">
              <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30 transition-all duration-200">
                <Plus className="w-5 h-5 mr-2" />
                Add Expense
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Balance</p>
                <p className={`text-3xl font-bold mt-2 ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {currencySymbol}{Math.abs(netBalance).toFixed(2)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {netBalance >= 0 ? 'you are owed' : 'you owe'}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${netBalance >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                <DollarSign className={`w-6 h-6 ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">You Owe</p>
                <p className="text-3xl font-bold mt-2 text-red-500">
                  {currencySymbol}{totalYouOwe.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {Object.keys(youOwe).length} {Object.keys(youOwe).length === 1 ? 'person' : 'people'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-red-100">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Owed to You</p>
                <p className="text-3xl font-bold mt-2 text-emerald-600">
                  {currencySymbol}{totalOweYou.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {Object.keys(oweYou).length} {Object.keys(oweYou).length === 1 ? 'person' : 'people'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Expenses</p>
                <p className="text-3xl font-bold mt-2 text-slate-900">
                  {expenses.length}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {currencySymbol}{expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} total
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-100">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {simplifiedTransactions.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Lightbulb className="w-5 h-5" />
                Debt Simplification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-700 mb-3">Minimize transactions with these simplified payments:</p>
              <div className="space-y-2">
                {simplifiedTransactions.map((txn, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                    <span className="text-sm">
                      {txn.from === user?.email ? 'You' : txn.from} → {txn.to === user?.email ? 'You' : txn.to}
                    </span>
                    <span className="font-semibold text-blue-700">{currencySymbol}{txn.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {nextPayer && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Lightbulb className="w-5 h-5 text-amber-600" />
                <p className="text-sm text-amber-900">
                  <span className="font-semibold">{nextPayer}</span> should pay the next expense to keep things fair
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BalanceCard title="You Owe" balances={youOwe} type="owe" isLoading={isLoading} currencySymbol={currencySymbol} />
          <BalanceCard title="Owed to You" balances={oweYou} type="owed" isLoading={isLoading} currencySymbol={currencySymbol} />
        </div>

        <RecentActivity
          expenses={searchQuery ? filteredExpenses : expenses}
          settlements={settlements}
          isLoading={isLoading}
          currentUserEmail={user?.email}
          currencySymbol={currencySymbol}
        />
      </div>
    </div>
  );
}
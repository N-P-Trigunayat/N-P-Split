import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function SettleUp() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [direction, setDirection] = useState("you_pay"); // you_pay or they_pay

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

  const createSettlementMutation = useMutation({
    mutationFn: (data) => base44.entities.Settlement.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      toast.success("Settlement recorded successfully!");
      navigate(createPageUrl("Dashboard"));
    },
    onError: () => {
      toast.error("Failed to record settlement");
    }
  });

  const calculateBalances = () => {
    if (!user?.email) return {};
    
    const balances = {};
    
    expenses.forEach(expense => {
      const splitAmount = expense.amount / expense.split_with.length;
      
      expense.split_with.forEach(person => {
        if (person === expense.paid_by) return;
        
        if (expense.paid_by === user.email) {
          balances[person] = (balances[person] || 0) + splitAmount;
        } else if (person === user.email) {
          balances[expense.paid_by] = (balances[expense.paid_by] || 0) - splitAmount;
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
    
    return Object.fromEntries(
      Object.entries(balances).filter(([_, amount]) => Math.abs(amount) >= 0.01)
    );
  };

  const balances = calculateBalances();
  const peopleWithBalances = Object.keys(balances);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!selectedPerson || !amount) {
      toast.error("Please select a person and enter an amount");
      return;
    }

    const settlementData = {
      from_user: direction === "you_pay" ? user.email : selectedPerson,
      to_user: direction === "you_pay" ? selectedPerson : user.email,
      amount: parseFloat(amount),
      date: new Date().toISOString().split('T')[0],
      note: note || undefined
    };

    createSettlementMutation.mutate(settlementData);
  };

  const getCurrentBalance = () => {
    if (!selectedPerson) return null;
    return balances[selectedPerson] || 0;
  };

  const currentBalance = getCurrentBalance();
  const isLoading = loadingExpenses || loadingSettlements;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Settle Up</h1>
            <p className="text-slate-500 mt-1">Record a payment to balance accounts</p>
          </div>
        </div>

        {isLoading ? (
          <Card className="shadow-lg border-slate-200">
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ) : peopleWithBalances.length === 0 ? (
          <Card className="shadow-lg border-slate-200">
            <CardContent className="p-12">
              <div className="text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">All Settled Up!</h3>
                <p className="text-slate-500">You don't have any outstanding balances</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit}>
            <Card className="shadow-lg border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-lg font-semibold">Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="person">With Whom?</Label>
                  <Select
                    value={selectedPerson}
                    onValueChange={(value) => {
                      setSelectedPerson(value);
                      const balance = balances[value];
                      if (balance < 0) {
                        setDirection("you_pay");
                        setAmount(Math.abs(balance).toFixed(2));
                      } else {
                        setDirection("they_pay");
                        setAmount(balance.toFixed(2));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a person" />
                    </SelectTrigger>
                    <SelectContent>
                      {peopleWithBalances.map(person => {
                        const balance = balances[person];
                        return (
                          <SelectItem key={person} value={person}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{person}</span>
                              <span className={`font-semibold text-sm ${balance > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {balance > 0 ? `owes you $${balance.toFixed(2)}` : `you owe $${Math.abs(balance).toFixed(2)}`}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPerson && currentBalance !== null && (
                  <div className={`p-4 rounded-xl border-2 ${
                    currentBalance > 0 
                      ? 'bg-emerald-50 border-emerald-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <p className="text-sm font-medium text-slate-700 mb-1">Current Balance:</p>
                    <p className={`text-2xl font-bold ${currentBalance > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {currentBalance > 0 
                        ? `${selectedPerson} owes you $${currentBalance.toFixed(2)}` 
                        : `You owe ${selectedPerson} $${Math.abs(currentBalance).toFixed(2)}`}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Who is Paying?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={direction === "you_pay" ? "default" : "outline"}
                      onClick={() => setDirection("you_pay")}
                      className={direction === "you_pay" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    >
                      You Pay Them
                    </Button>
                    <Button
                      type="button"
                      variant={direction === "they_pay" ? "default" : "outline"}
                      onClick={() => setDirection("they_pay")}
                      className={direction === "they_pay" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    >
                      They Pay You
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">$</span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-8 text-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note">Note (Optional)</Label>
                  <Textarea
                    id="note"
                    placeholder="Add a note about this payment..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(createPageUrl("Dashboard"))}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSettlementMutation.isPending || !selectedPerson || !amount}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl shadow-lg shadow-emerald-500/30"
              >
                {createSettlementMutation.isPending ? (
                  <>Recording...</>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Record Payment
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
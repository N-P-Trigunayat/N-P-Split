import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, X, Check, Upload } from "lucide-react";
import { toast } from "sonner";

const CURRENCIES = [
  { code: "USD", symbol: "$" }, { code: "EUR", symbol: "€" }, { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" }, { code: "CAD", symbol: "C$" }, { code: "AUD", symbol: "A$" },
  { code: "CHF", symbol: "CHF" }, { code: "CNY", symbol: "¥" }, { code: "INR", symbol: "₹" },
  { code: "MXN", symbol: "MX$" }, { code: "BRL", symbol: "R$" }, { code: "ZAR", symbol: "R" },
  { code: "SGD", symbol: "S$" }, { code: "NZD", symbol: "NZ$" }, { code: "KRW", symbol: "₩" },
  { code: "SEK", symbol: "kr" }, { code: "NOK", symbol: "kr" }, { code: "DKK", symbol: "kr" },
  { code: "PLN", symbol: "zł" }, { code: "THB", symbol: "฿" }, { code: "IDR", symbol: "Rp" },
];

const categories = [
  { value: "food", label: "🍕 Food & Drinks" },
  { value: "transportation", label: "🚗 Transportation" },
  { value: "entertainment", label: "🎬 Entertainment" },
  { value: "accommodation", label: "🏨 Accommodation" },
  { value: "utilities", label: "💡 Utilities" },
  { value: "shopping", label: "🛍️ Shopping" },
  { value: "groceries", label: "🛒 Groceries" },
  { value: "healthcare", label: "🏥 Healthcare" },
  { value: "other", label: "📦 Other" },
];

const paymentMethods = [
  { value: "cash", label: "💵 Cash" },
  { value: "credit_card", label: "💳 Credit Card" },
  { value: "venmo", label: "Venmo" },
  { value: "paypal", label: "PayPal" },
  { value: "zelle", label: "Zelle" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

export default function AddExpense() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  
  const urlParams = new URLSearchParams(window.location.search);
  const groupId = urlParams.get('group_id');

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    currency: "USD",
    date: new Date().toISOString().split('T')[0],
    category: "other",
    group_id: groupId || "",
    payers: [],
    split_method: "equal",
    splits: [],
    payment_method: "cash",
    receipt_url: "",
    due_date: "",
    comments: [],
    tags: []
  });

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      const defaultCurrency = u.default_currency || "USD";
      setFormData(prev => ({
        ...prev,
        currency: defaultCurrency,
        payers: [{ email: u.email, amount: 0 }],
        splits: [{ email: u.email, amount: 0, percentage: 100, shares: 1 }]
      }));
    }).catch(() => {});
  }, []);

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list(),
    initialData: [],
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success("Expense added successfully!");
      navigate(formData.group_id ? createPageUrl("GroupDetail") + `?id=${formData.group_id}` : createPageUrl("Dashboard"));
    },
    onError: () => {
      toast.error("Failed to add expense");
    }
  });

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingReceipt(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, receipt_url: file_url });
      toast.success("Receipt uploaded!");
    } catch (error) {
      toast.error("Failed to upload receipt");
    }
    setUploadingReceipt(false);
  };

  const addPerson = () => {
    if (!newEmail.trim()) return;
    if (formData.splits.some(s => s.email === newEmail.trim())) {
      toast.error("This person is already added");
      return;
    }
    
    const newSplit = {
      email: newEmail.trim(),
      amount: 0,
      percentage: 0,
      shares: 1
    };
    
    setFormData(prev => ({
      ...prev,
      splits: [...prev.splits, newSplit]
    }));
    setNewEmail("");
    recalculateSplits([...formData.splits, newSplit]);
  };

  const removePerson = (email) => {
    if (email === user?.email) {
      toast.error("You must be included in the split");
      return;
    }
    const newSplits = formData.splits.filter(s => s.email !== email);
    setFormData(prev => ({ ...prev, splits: newSplits }));
    recalculateSplits(newSplits);
  };

  const recalculateSplits = (splits = formData.splits) => {
    const amount = parseFloat(formData.amount) || 0;
    
    if (formData.split_method === "equal") {
      const splitAmount = amount / splits.length;
      const updatedSplits = splits.map(s => ({ ...s, amount: splitAmount }));
      setFormData(prev => ({ ...prev, splits: updatedSplits }));
    } else if (formData.split_method === "percentage") {
      const updatedSplits = splits.map(s => ({
        ...s,
        amount: (amount * (s.percentage || 0)) / 100
      }));
      setFormData(prev => ({ ...prev, splits: updatedSplits }));
    } else if (formData.split_method === "shares") {
      const totalShares = splits.reduce((sum, s) => sum + (s.shares || 1), 0);
      const updatedSplits = splits.map(s => ({
        ...s,
        amount: (amount * (s.shares || 1)) / totalShares
      }));
      setFormData(prev => ({ ...prev, splits: updatedSplits }));
    }
  };

  useEffect(() => {
    if (formData.amount && formData.split_method !== "exact") {
      recalculateSplits();
    }
  }, [formData.amount, formData.split_method]);

  const updateSplitAmount = (email, value, field = "amount") => {
    const updatedSplits = formData.splits.map(s =>
      s.email === email ? { ...s, [field]: parseFloat(value) || 0 } : s
    );
    setFormData({ ...formData, splits: updatedSplits });
    
    if (formData.split_method !== "exact" && field !== "amount") {
      recalculateSplits(updatedSplits);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.description || !formData.amount || formData.splits.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    const totalSplit = formData.splits.reduce((sum, s) => sum + s.amount, 0);
    const amount = parseFloat(formData.amount);
    
    if (Math.abs(totalSplit - amount) > 0.01) {
      toast.error("Split amounts don't match total expense");
      return;
    }

    const payerAmount = parseFloat(formData.amount);
    const payers = [{ email: formData.payers[0]?.email || user.email, amount: payerAmount }];

    createExpenseMutation.mutate({
      ...formData,
      amount: payerAmount,
      payers
    });
  };

  const getCurrencySymbol = () => {
    return CURRENCIES.find(c => c.code === formData.currency)?.symbol || "$";
  };

  const splitAmountDisplay = formData.amount && formData.splits.length > 0 && formData.split_method === "equal"
    ? (parseFloat(formData.amount) / formData.splits.length).toFixed(2)
    : "0.00";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(formData.group_id ? createPageUrl("GroupDetail") + `?id=${formData.group_id}` : createPageUrl("Dashboard"))}
            className="rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Add Expense</h1>
            <p className="text-slate-500 mt-1">Split a new expense with friends</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="shadow-lg border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg font-semibold">Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Input
                  id="description"
                  placeholder="e.g., Dinner at restaurant"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="text-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
                      {getCurrencySymbol()}
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="pl-10 text-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {CURRENCIES.map(curr => (
                        <SelectItem key={curr.code} value={curr.code}>
                          <span className="font-mono">{curr.symbol} {curr.code}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Payment Method</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(pm => (
                        <SelectItem key={pm.value} value={pm.value}>
                          {pm.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {groups.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="group">Group (Optional)</Label>
                    <Select
                      value={formData.group_id}
                      onValueChange={(value) => setFormData({ ...formData, group_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>No group</SelectItem>
                        {groups.map(group => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Receipt (Optional)</Label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleReceiptUpload}
                    className="hidden"
                    id="receipt-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('receipt-upload').click()}
                    disabled={uploadingReceipt}
                    className="flex-1"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingReceipt ? "Uploading..." : formData.receipt_url ? "Change Receipt" : "Upload Receipt"}
                  </Button>
                  {formData.receipt_url && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(formData.receipt_url, '_blank')}
                    >
                      View
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date (Optional)</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg font-semibold">Split Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label>Split Method</Label>
                <Tabs value={formData.split_method} onValueChange={(v) => setFormData({ ...formData, split_method: v })}>
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="equal">Equal</TabsTrigger>
                    <TabsTrigger value="exact">Exact</TabsTrigger>
                    <TabsTrigger value="percentage">%</TabsTrigger>
                    <TabsTrigger value="shares">Shares</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-3">
                <Label>Split With *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="friend@email.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPerson())}
                  />
                  <Button
                    type="button"
                    onClick={addPerson}
                    variant="outline"
                    className="shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {formData.splits.map(split => (
                    <div key={split.email} className="flex items-center gap-2 p-3 border rounded-lg">
                      <span className="flex-1 text-sm font-medium">
                        {split.email === user?.email ? 'You' : split.email}
                      </span>
                      
                      {formData.split_method === "exact" && (
                        <Input
                          type="number"
                          step="0.01"
                          value={split.amount}
                          onChange={(e) => updateSplitAmount(split.email, e.target.value, "amount")}
                          className="w-24"
                          placeholder="0.00"
                        />
                      )}
                      
                      {formData.split_method === "percentage" && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="1"
                            value={split.percentage}
                            onChange={(e) => updateSplitAmount(split.email, e.target.value, "percentage")}
                            className="w-20"
                            placeholder="0"
                          />
                          <span className="text-sm">%</span>
                        </div>
                      )}
                      
                      {formData.split_method === "shares" && (
                        <Input
                          type="number"
                          step="1"
                          value={split.shares}
                          onChange={(e) => updateSplitAmount(split.email, e.target.value, "shares")}
                          className="w-20"
                          placeholder="1"
                        />
                      )}
                      
                      <span className="text-sm font-semibold text-emerald-600 w-24 text-right">
                        {getCurrencySymbol()}{split.amount.toFixed(2)}
                      </span>
                      
                      {split.email !== user?.email && (
                        <button
                          type="button"
                          onClick={() => removePerson(split.email)}
                          className="hover:bg-red-50 rounded-full p-1 transition-colors"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {formData.amount && formData.splits.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Total:</span>
                      <span className="font-bold text-lg text-slate-900">
                        {getCurrencySymbol()}{formData.splits.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}
                      </span>
                    </div>
                    {formData.split_method === "equal" && (
                      <p className="text-xs text-slate-500 mt-2">
                        Each person pays {getCurrencySymbol()}{splitAmountDisplay}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(formData.group_id ? createPageUrl("GroupDetail") + `?id=${formData.group_id}` : createPageUrl("Dashboard"))}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createExpenseMutation.isPending}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl shadow-lg shadow-emerald-500/30"
            >
              {createExpenseMutation.isPending ? (
                <>Processing...</>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Add Expense
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
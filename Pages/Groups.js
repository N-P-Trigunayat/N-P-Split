import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Home, Heart, Plane, MoreHorizontal, Trash2, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const groupTypeIcons = {
  trip: Plane,
  home: Home,
  couple: Heart,
  other: Users
};

const groupTypeColors = {
  trip: "bg-blue-100 text-blue-700",
  home: "bg-green-100 text-green-700",
  couple: "bg-pink-100 text-pink-700",
  other: "bg-slate-100 text-slate-700"
};

export default function Groups() {
  const [user, setUser] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "other",
    members: [],
    default_currency: "USD",
    simplify_debts: true
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setFormData(prev => ({ ...prev, members: [u.email] }));
    });
  }, []);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list('-created_date'),
    initialData: [],
  });

  const createGroupMutation = useMutation({
    mutationFn: (data) => base44.entities.Group.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setShowCreateDialog(false);
      setFormData({
        name: "",
        description: "",
        type: "other",
        members: [user?.email],
        default_currency: "USD",
        simplify_debts: true
      });
      toast.success("Group created successfully!");
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id) => base44.entities.Group.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success("Group deleted successfully!");
    },
  });

  const addMember = () => {
    if (!newMemberEmail.trim()) return;
    if (formData.members.includes(newMemberEmail.trim())) {
      toast.error("Member already added");
      return;
    }
    setFormData(prev => ({
      ...prev,
      members: [...prev.members, newMemberEmail.trim()]
    }));
    setNewMemberEmail("");
  };

  const removeMember = (email) => {
    if (email === user?.email) {
      toast.error("You must be a member of the group");
      return;
    }
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter(e => e !== email)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || formData.members.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }
    createGroupMutation.mutate(formData);
  };

  const myGroups = groups.filter(g => g.members?.includes(user?.email));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Groups</h1>
            <p className="text-slate-500 mt-1">Organize expenses with groups</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
                <Plus className="w-5 h-5 mr-2" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Group Name *</Label>
                  <Input
                    placeholder="e.g., Trip to Paris"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="Optional description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Group Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trip">🛫 Trip</SelectItem>
                      <SelectItem value="home">🏠 Home</SelectItem>
                      <SelectItem value="couple">💑 Couple</SelectItem>
                      <SelectItem value="other">📦 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Add Members</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="member@email.com"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMember())}
                    />
                    <Button type="button" onClick={addMember} variant="outline">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.members.map(email => (
                      <Badge key={email} variant="secondary" className="gap-2">
                        {email === user?.email ? 'You' : email}
                        {email !== user?.email && (
                          <button type="button" onClick={() => removeMember(email)} className="hover:text-red-600">
                            ×
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createGroupMutation.isPending}>
                  {createGroupMutation.isPending ? "Creating..." : "Create Group"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
            ))}
          </div>
        ) : myGroups.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Groups Yet</h3>
              <p className="text-slate-500 mb-4">Create a group to start splitting expenses</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myGroups.map(group => {
              const Icon = groupTypeIcons[group.type];
              return (
                <Card key={group.id} className="hover:shadow-lg transition-all duration-200 border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl ${groupTypeColors[group.type]} flex items-center justify-center`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteGroupMutation.mutate(group.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Link to={createPageUrl("GroupDetail") + `?id=${group.id}`}>
                      <h3 className="text-xl font-bold text-slate-900 mb-2 hover:text-emerald-600 transition-colors">
                        {group.name}
                      </h3>
                    </Link>
                    {group.description && (
                      <p className="text-sm text-slate-500 mb-3">{group.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users className="w-4 h-4" />
                      <span>{group.members?.length || 0} members</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
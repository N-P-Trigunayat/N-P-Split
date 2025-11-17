import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Trash2, Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Friends() {
  const [user, setUser] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newFriendEmail, setNewFriendEmail] = useState("");
  const [newFriendName, setNewFriendName] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: friends, isLoading } = useQuery({
    queryKey: ['friends', user?.email],
    queryFn: () => base44.entities.Friend.filter({ user_email: user.email }),
    initialData: [],
    enabled: !!user?.email,
  });

  const addFriendMutation = useMutation({
    mutationFn: (data) => base44.entities.Friend.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      setShowAddDialog(false);
      setNewFriendEmail("");
      setNewFriendName("");
      toast.success("Friend added successfully!");
    },
  });

  const deleteFriendMutation = useMutation({
    mutationFn: (id) => base44.entities.Friend.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      toast.success("Friend removed");
    },
  });

  const handleAddFriend = () => {
    if (!newFriendEmail.trim()) {
      toast.error("Please enter an email");
      return;
    }
    addFriendMutation.mutate({
      user_email: user.email,
      friend_email: newFriendEmail.trim(),
      friend_name: newFriendName.trim() || newFriendEmail.trim(),
      added_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Friends</h1>
            <p className="text-slate-500 mt-1">Manage your friends list</p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
                <UserPlus className="w-5 h-5 mr-2" />
                Add Friend
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Friend</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Input
                    placeholder="friend@email.com"
                    value={newFriendEmail}
                    onChange={(e) => setNewFriendEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Friend's Name (optional)"
                    value={newFriendName}
                    onChange={(e) => setNewFriendName(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAddFriend}
                  className="w-full"
                  disabled={addFriendMutation.isPending}
                >
                  {addFriendMutation.isPending ? "Adding..." : "Add Friend"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-16" /></CardContent></Card>
            ))}
          </div>
        ) : friends.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="p-12 text-center">
              <UserPlus className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Friends Yet</h3>
              <p className="text-slate-500">Add friends to track balances</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {friends.map(friend => (
              <Card key={friend.id} className="hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center">
                        <span className="text-slate-700 font-bold text-lg">
                          {friend.friend_name?.[0]?.toUpperCase() || 'F'}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{friend.friend_name}</p>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Mail className="w-3 h-3" />
                          {friend.friend_email}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFriendMutation.mutate(friend.id)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
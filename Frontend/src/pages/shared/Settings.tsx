import React, { useState } from 'react';
import { PrisonLayout } from '@/components/PrisonLayout';
import { useTheme } from '@/contexts/ThemeProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Moon, Bell, User, Phone, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(() => localStorage.getItem('2fa_enabled') === 'true');
  const [phoneNumber, setPhoneNumber] = useState('+260 97 1234567');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave2FA = () => {
    setIsSaving(true);
    setTimeout(() => {
      localStorage.setItem('2fa_enabled', String(twoFactorEnabled));
      toast({
        title: "Security Settings Updated",
        description: `Two-Factor Authentication is now ${twoFactorEnabled ? 'enabled' : 'disabled'}.`
      });
      setIsSaving(false);
    }, 600);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      toast({
        title: "Profile Updated",
        description: "Your profile details have been saved successfully."
      });
      setIsSaving(false);
    }, 600);
  };

  return (
    <PrisonLayout title="Settings" description="Manage your preferences and security">
      <div className="max-w-4xl mx-auto py-6">
        <Tabs defaultValue="appearance" className="w-full flex flex-col md:flex-row gap-6">
          <TabsList className="flex md:flex-col justify-start h-auto bg-transparent gap-2 w-full md:w-64">
            <TabsTrigger value="appearance" className="w-full justify-start gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Moon size={16} /> Appearance
            </TabsTrigger>
            <TabsTrigger value="security" className="w-full justify-start gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Shield size={16} /> Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="w-full justify-start gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Bell size={16} /> Notifications
            </TabsTrigger>
            <TabsTrigger value="account" className="w-full justify-start gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <User size={16} /> Account
            </TabsTrigger>
          </TabsList>

          <div className="flex-1">
            {/* Appearance Tab */}
            <TabsContent value="appearance" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle>Appearance Settings</CardTitle>
                  <CardDescription>Customize how the application looks on your device.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base">Theme</Label>
                      <p className="text-sm text-gray-500 mb-4">Select the color theme for the interface.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div 
                          className={`border-2 rounded-lg p-4 cursor-pointer flex flex-col items-center gap-2 ${theme === 'light' ? 'border-[#0b4f2a] bg-[#d7a928]/10' : 'border-gray-200 hover:border-gray-300'}`}
                          onClick={() => setTheme('light')}
                        >
                          <div className="w-full h-20 bg-gray-100 rounded border flex items-center justify-center shadow-inner">
                            <div className="w-16 h-10 bg-white rounded shadow-sm border"></div>
                          </div>
                          <span className="font-medium">Light</span>
                        </div>

                        <div 
                          className={`border-2 rounded-lg p-4 cursor-pointer flex flex-col items-center gap-2 ${theme === 'dark' ? 'border-[#0b4f2a] bg-[#d7a928]/10/10' : 'border-gray-200 hover:border-gray-300'}`}
                          onClick={() => setTheme('dark')}
                        >
                          <div className="w-full h-20 bg-gray-900 rounded border border-gray-700 flex items-center justify-center shadow-inner">
                            <div className="w-16 h-10 bg-gray-800 rounded shadow-sm border border-gray-700"></div>
                          </div>
                          <span className="font-medium">Dark</span>
                        </div>

                        <div 
                          className={`border-2 rounded-lg p-4 cursor-pointer flex flex-col items-center gap-2 ${theme === 'system' ? 'border-[#0b4f2a] bg-[#d7a928]/10/10' : 'border-gray-200 hover:border-gray-300'}`}
                          onClick={() => setTheme('system')}
                        >
                          <div className="w-full h-20 bg-gradient-to-r from-gray-100 to-gray-900 rounded border flex items-center justify-center shadow-inner">
                            <div className="w-16 h-10 bg-gradient-to-r from-white to-gray-800 rounded shadow-sm border"></div>
                          </div>
                          <span className="font-medium">System</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle>Security & Two-Factor Authentication</CardTitle>
                  <CardDescription>Manage how you securely sign in to your account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  <div className="flex items-start justify-between p-4 border rounded-lg bg-gray-50/50">
                    <div className="space-y-1">
                      <Label className="text-base font-semibold flex items-center gap-2">
                        Two-Factor Authentication (2FA)
                        {twoFactorEnabled && <CheckCircle2 size={16} className="text-green-600" />}
                      </Label>
                      <p className="text-sm text-gray-500 max-w-sm">
                        Require an SMS verification code in addition to your password when logging in.
                      </p>
                    </div>
                    <Switch 
                      checked={twoFactorEnabled} 
                      onCheckedChange={setTwoFactorEnabled}
                    />
                  </div>

                  {twoFactorEnabled && (
                    <div className="space-y-3 p-4 border rounded-lg animate-in fade-in slide-in-from-top-4">
                      <Label htmlFor="phone">Verified Phone Number for SMS</Label>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input 
                            id="phone" 
                            className="pl-9" 
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+260 97 0000000" 
                          />
                        </div>
                        <Button variant="outline">Update Number</Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        This number will be used to send your secure login codes.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 pt-4 border-t">
                    <Label>Change Password</Label>
                    <div className="grid gap-4">
                      <Input type="password" placeholder="Current Password" />
                      <Input type="password" placeholder="New Password" />
                      <Input type="password" placeholder="Confirm New Password" />
                    </div>
                  </div>

                </CardContent>
                <CardFooter>
                  <Button onClick={handleSave2FA} disabled={isSaving}>
                    {isSaving ? 'Saving Changes...' : 'Save Security Settings'}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Configure how you receive alerts and updates.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Email Notifications</Label>
                        <p className="text-sm text-gray-500">Receive daily summaries and critical alerts via email.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">SMS Alerts</Label>
                        <p className="text-sm text-gray-500">Receive emergency system alerts via SMS.</p>
                      </div>
                      <Switch defaultChecked={false} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">In-App Sound</Label>
                        <p className="text-sm text-gray-500">Play a sound when a new message is received.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline">Save Preferences</Button>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* Account Tab */}
            <TabsContent value="account" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle>Account Details</CardTitle>
                  <CardDescription>Update your personal information.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSaveProfile}>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input defaultValue="System" />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input defaultValue="User" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Service Number / Username</Label>
                      <Input defaultValue="ADMIN" disabled />
                      <p className="text-xs text-gray-500">Your service number cannot be changed.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Primary Email</Label>
                      <Input defaultValue="admin@zpcs.gov.zm" type="email" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Updating...' : 'Update Profile'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </PrisonLayout>
  );
};

export default SettingsPage;

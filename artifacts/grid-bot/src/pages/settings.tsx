import { Layout } from "@/components/layout";
import { getPrivateKey, derivePublicKey, savePrivateKey, saveEndpoint, getEndpoint } from "@/lib/keys";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, ShieldAlert, Wallet } from "lucide-react";

export default function Settings() {
  const [pk, setPk] = useState("");
  const [pubkey, setPubkey] = useState("");
  const [endpoint, setEndpoint] = useState("staging");
  const { toast } = useToast();

  useEffect(() => {
    const saved = getPrivateKey();
    if (saved) {
      setPk(saved);
      const derived = derivePublicKey(saved);
      if (derived) setPubkey(derived);
    }
    setEndpoint(getEndpoint());
  }, []);

  const handleSaveKey = () => {
    if (!pk) return;
    savePrivateKey(pk);
    const derived = derivePublicKey(pk);
    if (derived) {
      setPubkey(derived);
      toast({ title: "Wallet Saved", description: "Private key saved locally." });
    } else {
      toast({ title: "Invalid Key", description: "Could not derive public key.", variant: "destructive" });
    }
  };

  const handleEnvChange = (val: string) => {
    setEndpoint(val);
    saveEndpoint(val as any);
    toast({ title: "Environment Updated", description: `Set to ${val}` });
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Manage your wallet and connection settings.</p>
        </div>

        <Card className="border-red-900/50 bg-red-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <ShieldAlert className="h-5 w-5" />
              Security Notice
            </CardTitle>
            <CardDescription className="text-red-400/80">
              Your private key is stored ONLY in your browser's localStorage. It is never transmitted to our servers.
              Transactions are signed locally before being broadcasted.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Configuration
            </CardTitle>
            <CardDescription>Setup the wallet that will execute trades.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Private Key (Base58)</Label>
              <div className="flex gap-2">
                <Input 
                  type="password" 
                  value={pk} 
                  onChange={e => setPk(e.target.value)} 
                  placeholder="Enter base58 private key"
                />
                <Button onClick={handleSaveKey}>Save</Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Derived Public Key (Account)</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm font-mono break-all text-muted-foreground">
                <KeyRound className="h-4 w-4 shrink-0" />
                {pubkey || "No key configured"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Environment</Label>
              <Select value={endpoint} onValueChange={handleEnvChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">Staging (staging-api.bulk.trade)</SelectItem>
                  <SelectItem value="production">Production (api.bulk.trade)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

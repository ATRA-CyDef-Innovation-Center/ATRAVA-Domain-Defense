'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
export function AddDomainDialog({ type, onSubmit, triggerLabel, submitLabel }) {
    const [open, setOpen] = useState(false);
    const [domain, setDomain] = useState('');
    const [threatLevel, setThreatLevel] = useState('medium');
    const [sources, setSources] = useState([]);
    const [reason, setReason] = useState('');
    const threatLevelOptions = ['critical', 'high', 'medium', 'low'];
    const sourceOptions = ['malware', 'phishing', 'botnet', 'c2', 'exploit', 'ransomware'];
    const handleAddSource = (source) => {
        if (!sources.includes(source)) {
            setSources([...sources, source]);
        }
    };
    const handleRemoveSource = (source) => {
        setSources(sources.filter((s) => s !== source));
    };
    const handleSubmit = () => {
        const data = Object.assign(Object.assign({ domain }, (type === 'blacklist' && { threatLevel, sources })), (type === 'whitelist' && { reason }));
        onSubmit === null || onSubmit === void 0 ? void 0 : onSubmit(data);
        setOpen(false);
        setDomain('');
        setSources([]);
        setReason('');
    };
    return (<Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          {triggerLabel || `Add ${type === 'blacklist' ? 'Malicious' : 'Whitelisted'} Domain`}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            Add {type === 'blacklist' ? 'Blacklisted' : 'Whitelisted'} Domain
          </DialogTitle>
          <DialogDescription>
            Add a new domain to the {type} list
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Domain Input */}
          <div className="space-y-2">
            <Label htmlFor="domain" className="text-foreground">
              Domain Name
            </Label>
            <Input id="domain" placeholder="example.com or subdomain.example.com" value={domain} onChange={(e) => setDomain(e.target.value)} className="bg-secondary border-border"/>
          </div>

          {type === 'blacklist' && (<>
              {/* Threat Level */}
              <div className="space-y-2">
                <Label htmlFor="threat-level" className="text-foreground">
                  Threat Level
                </Label>
                <Select value={threatLevel} onValueChange={setThreatLevel}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {threatLevelOptions.map((level) => (<SelectItem key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              {/* Threat Sources */}
              <div className="space-y-2">
                <Label className="text-foreground">Threat Sources</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {sourceOptions.map((source) => (<button key={source} onClick={() => handleAddSource(source)} className={`px-3 py-1 rounded-full text-sm transition-colors ${sources.includes(source)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'}`}>
                      + {source}
                    </button>))}
                </div>
                {sources.length > 0 && (<div className="flex flex-wrap gap-2">
                    {sources.map((source) => (<Badge key={source} variant="secondary" className="flex items-center gap-1">
                        {source}
                        <button onClick={() => handleRemoveSource(source)} className="ml-1 hover:text-destructive">
                          <X className="w-3 h-3"/>
                        </button>
                      </Badge>))}
                  </div>)}
              </div>
            </>)}

          {type === 'whitelist' && (<div className="space-y-2">
              <Label htmlFor="reason" className="text-foreground">
                Reason for Whitelisting
              </Label>
              <Textarea id="reason" placeholder="Explain why this domain should be whitelisted..." value={reason} onChange={(e) => setReason(e.target.value)} className="bg-secondary border-border"/>
            </div>)}
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!domain.trim()}>
            {submitLabel || 'Add Domain'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>);
}
export function BulkImportDialog({ type, onSubmit, triggerLabel, submitLabel }) {
    const [open, setOpen] = useState(false);
    const [csvContent, setCsvContent] = useState('');
    const [fileType, setFileType] = useState('csv');
    const handleFileUpload = (e) => {
        var _a;
        const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                var _a;
                setCsvContent((_a = event.target) === null || _a === void 0 ? void 0 : _a.result);
            };
            reader.readAsText(file);
        }
    };
    const handleSubmit = () => {
        onSubmit === null || onSubmit === void 0 ? void 0 : onSubmit({
            type: 'bulk_import',
            content: csvContent,
            fileType,
        });
        setOpen(false);
        setCsvContent('');
    };
    return (<Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          {triggerLabel || 'Bulk Import'}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Domains</DialogTitle>
          <DialogDescription>
            Import multiple domains from a CSV or JSON file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Type */}
          <div className="space-y-2">
            <Label className="text-foreground">File Format</Label>
            <div className="flex gap-4">
              {['csv', 'json'].map((type) => (<label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="file-type" value={type} checked={fileType === type} onChange={(e) => setFileType(e.target.value)} className="w-4 h-4"/>
                  <span className="text-sm text-foreground">{type.toUpperCase()}</span>
                </label>))}
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file-upload" className="text-foreground">
              Upload File
            </Label>
            <Input id="file-upload" type="file" accept={fileType === 'csv' ? '.csv' : '.json'} onChange={handleFileUpload} className="bg-secondary border-border cursor-pointer"/>
          </div>

          {/* Preview */}
          {csvContent && (<div className="space-y-2">
              <Label className="text-foreground">Preview</Label>
              <div className="bg-secondary border border-border rounded-lg p-4 h-40 overflow-y-auto font-mono text-xs text-muted-foreground">
                {csvContent.substring(0, 500)}
                {csvContent.length > 500 && '...'}
              </div>
            </div>)}

          {/* Format Help */}
          <div className="bg-secondary/50 border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2 font-medium">Expected Format:</p>
            <div className="font-mono text-xs text-muted-foreground space-y-1">
              {fileType === 'csv' ? (<>
                  <p>domain,threat_level,sources</p>
                  <p>malware.com,critical,"malware,botnet"</p>
                  <p>phishing.net,high,phishing</p>
                </>) : (<>
                  <p>{'[{'}</p>
                  <p>{'  "domain": "malware.com",'}</p>
                  <p>{'  "threatLevel": "critical",'}</p>
                  <p>{'  "sources": ["malware", "botnet"]'}</p>
                  <p>{'}'}</p>
                  <p>{']'}</p>
                </>)}
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!csvContent.trim()}>
            {submitLabel || 'Import Domains'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>);
}

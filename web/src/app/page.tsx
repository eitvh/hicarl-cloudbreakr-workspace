import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle><h1>Lambda Automation Monitoring</h1></CardTitle>
          <CardDescription>Instagram post automation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your monitoring app is ready for development. Connect the Lambda
            backend to display automation activity here.
          </p>
          <Button disabled>Backend not connected</Button>
        </CardContent>
      </Card>
    </main>
  );
}

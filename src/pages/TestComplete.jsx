export default function TestComplete() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="card max-w-md w-full text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Submitted Successfully!</h1>
        <p className="text-gray-600 mb-6">
          Thank you for completing the test. Your answers have been submitted and will be reviewed by our team.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-semibold mb-2">What happens next?</p>
          <ul className="text-left space-y-1">
            <li>• Your answers are being automatically graded</li>
            <li>• Our team will review descriptive answers</li>
            <li>• You'll receive an email with results</li>
            <li>• Check your inbox in 2-3 business days</li>
          </ul>
        </div>
        <p className="text-sm text-gray-500 mt-6">
          You may now close this window.
        </p>
      </div>
    </div>
  );
}

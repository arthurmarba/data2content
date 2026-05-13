import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveAnswerKeyResult,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationStrategicPlan,
} from "../../postCreationAdaptiveTypes";
import { AdaptiveV2AnswerKeyPreview } from "./AdaptiveV2AnswerKeyPreview";
import { AdaptiveV2IntentPreview } from "./AdaptiveV2IntentPreview";
import { AdaptiveV2PlanPreview } from "./AdaptiveV2PlanPreview";
import { AdaptiveV2QuestionPreview } from "./AdaptiveV2QuestionPreview";

export type AdaptiveV2PreviewProps = {
  detection: PostCreationAdaptiveIntentDetection;
  questions: PostCreationAdaptiveQuestion[];
  answers: PostCreationAdaptiveAnswer[];
  answerKey: PostCreationAdaptiveAnswerKeyResult;
  plan: PostCreationStrategicPlan;
};

export function AdaptiveV2Preview({
  detection,
  questions,
  answers,
  answerKey,
  plan,
}: AdaptiveV2PreviewProps) {
  return (
    <div className="space-y-4 rounded-lg bg-zinc-100 p-4 text-zinc-950">
      <AdaptiveV2IntentPreview detection={detection} />
      <AdaptiveV2QuestionPreview questions={questions} answers={answers} />
      <AdaptiveV2AnswerKeyPreview answerKey={answerKey} />
      <AdaptiveV2PlanPreview plan={plan} />
    </div>
  );
}

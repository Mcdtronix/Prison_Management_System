import React, { useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, AlertCircle, Info, Calculator } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { computeEffectiveSentence, type SentenceCount } from '@/lib/sentence';

interface ReleaseDatesProps {
    form: UseFormReturn<any>;
    /** Counts already on record for this inmate; they share the same release dates. */
    existingCounts?: SentenceCount[];
}

const ReleaseDates: React.FC<ReleaseDatesProps> = ({ form, existingCounts = [] }) => {
    const offences = form.watch("offences") || [];
    const restitutions = form.watch("restitutions") || [];

    const summary = useMemo(() => {
        // Same rule as the backend: concurrent counts count once (longest),
        // everything else runs one after another from the earliest sentence date.
        const newCounts: SentenceCount[] = offences
            .map((o: any, i: number) => ({ o, i }))
            .filter(({ o }: any) => o.convictionStatus === 'convicted')
            .map(({ o, i }: any) => ({
                key: `new:${i}`,
                years: parseInt(o.sentenceYears) || 0,
                months: parseInt(o.sentenceMonths) || 0,
                days: parseInt(o.sentenceDays) || 0,
                sentenceDate: o.sentenceDate,
                concurrentWith: o.concurrentWith || null,
            }));
        const effective = computeEffectiveSentence([...existingCounts, ...newCounts]);
        const totalDays = effective.totalDays;
        const concurrentSets = effective.concurrentSets.length;
        const standardRemission = Math.floor(totalDays / 3);
        const standardEffective = totalDays;

        let restitutionDays = 0;
        restitutions.forEach((r: any) => {
            const days = (parseInt(r.restitutionSentenceYears) || 0) * 365 +
                (parseInt(r.restitutionSentenceMonths) || 0) * 30 +
                (parseInt(r.restitutionSentenceDays) || 0);
            restitutionDays += days;
        });

        const netDays = Math.max(0, totalDays - restitutionDays);
        const restitutionRemission = Math.floor(netDays / 3);

        return {
            totalDays,
            standardRemission,
            standardEffective,
            restitutionDays,
            netDays,
            restitutionRemission,
            hasRestitution: restitutions.length > 0,
            months: effective.months,
            concurrentSets,
        };
    }, [offences, restitutions, existingCounts]);

    return (
        <Card className="border-indigo-200 bg-indigo-50/30">
            <CardHeader className="pb-3">
                <div className="flex items-center">
                    <Calculator className="mr-2 h-5 w-5 text-indigo-700" />
                    <CardTitle className="text-indigo-900">Computed Release Dates Summary</CardTitle>
                </div>
                <CardDescription className="text-indigo-700 font-medium">
                    These values are automatically calculated based on the sentences and restitutions provided. Please verify them before registering.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-md border border-indigo-100 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Standard Computation</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b pb-1">
                                <span className="text-gray-600">Total Effective Sentence:</span>
                                <span className="font-semibold">{summary.months} Months ({summary.totalDays} Days)</span>
                            </div>
                            <div className="flex justify-between border-b pb-1">
                                <span className="text-gray-600">Remission (1/3):</span>
                                <span className="font-semibold text-emerald-600">{summary.standardRemission} Days</span>
                            </div>
                            <div className="flex justify-between pt-1">
                                <span className="text-gray-600">Net Days Served:</span>
                                <span className="font-bold text-indigo-700">{summary.totalDays - summary.standardRemission} Days</span>
                            </div>
                            {summary.concurrentSets > 0 && (
                                <p className="pt-1 text-xs text-indigo-600">
                                    Includes {summary.concurrentSets} set{summary.concurrentSets > 1 ? 's' : ''} of concurrent counts, each counted once at its longest sentence.
                                </p>
                            )}
                        </div>
                    </div>

                    {summary.hasRestitution && (
                        <div className="bg-white p-4 rounded-md border border-amber-200 shadow-sm">
                            <h4 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-2">If Restitution is Paid</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between border-b border-amber-100 pb-1">
                                    <span className="text-gray-600">Sentence Reduction:</span>
                                    <span className="font-semibold text-amber-700">-{summary.restitutionDays} Days</span>
                                </div>
                                <div className="flex justify-between border-b border-amber-100 pb-1">
                                    <span className="text-gray-600">New Effective Sentence:</span>
                                    <span className="font-semibold">{summary.netDays} Days</span>
                                </div>
                                <div className="flex justify-between border-b border-amber-100 pb-1">
                                    <span className="text-gray-600">New Remission (1/3):</span>
                                    <span className="font-semibold text-emerald-600">{summary.restitutionRemission} Days</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span className="text-gray-600">Net Days Served:</span>
                                    <span className="font-bold text-indigo-700">{summary.netDays - summary.restitutionRemission} Days</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {summary.hasRestitution && (
                    <Alert className="bg-[#d7a928]/10 border-[#d7a928]">
                        <Info className="h-4 w-4 text-[#0b4f2a]" />
                        <AlertTitle className="text-blue-800">Restitution Conditions</AlertTitle>
                        <AlertDescription className="text-blue-700 text-xs mt-1">
                            The Alternative Computation will only become active if the restitution is fully paid and the official receipt is uploaded before the assigned deadline. Until then, the Standard Computation applies.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
};

export default ReleaseDates;

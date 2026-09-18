import { useState } from "react";
import { useMyJobs } from "@/features/jobs/use-jobs";
import { useRecommendedInstructors } from "@/features/matching/use-matching";
import type { RouteProps } from "@/types/supplyed";
import { Avatar, Btn } from "../atoms";
import { MatchScorePanel, PageHead, SectionLoader } from "../molecules";
export function RecommendedTeachersPanel({ go }: Pick<RouteProps, "go" | "toast" | "role">) {
  const [selected, setSelected] = useState("");
  const [page, setPage] = useState(1);
  const jobs = useMyJobs();
  const jobId = selected || jobs.data?.[0]?.id;
  const matches = useRecommendedInstructors(jobId, { page, limit: 20 });
  return (
    <div className="mt-5">
      <PageHead
        title="Recommended instructors"
        subtitle="Select one of your roles to find instructors whose experience and skills match it."
      />
      <label className="mb-5 block text-sm">
        Your role
        <select
          className="select mt-2"
          value={jobId ?? ""}
          onChange={(event) => {
            setSelected(event.target.value);
            setPage(1);
          }}
        >
          <option value="" disabled>
            Select a role
          </option>
          {jobs.data?.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>
      </label>
      {jobs.isLoading || matches.isLoading ? (
        <SectionLoader rows={3} />
      ) : jobs.isError || matches.isError ? (
        <div role="alert" className="card card-pad">
          <p>{jobs.error?.message || matches.error?.message}</p>
          <Btn
            onClick={() => {
              void jobs.refetch();
              if (jobId) void matches.refetch();
            }}
          >
            Try again
          </Btn>
        </div>
      ) : !jobId ? (
        <div className="card card-pad">
          <p>Post a role to see suitable instructors.</p>
          <Btn className="mt-3" onClick={() => go("post-job")}>
            Post a job
          </Btn>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.data?.instructors.map(({ instructor, match }) => (
            <article className="card card-pad-lg" key={instructor.id}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Avatar name={instructor.fullName} />
                <div className="flex-1">
                  <h2 className="font-serif text-2xl">{instructor.fullName}</h2>
                  <p className="text-sm text-muted">{instructor.city || "Location not shared"}</p>
                </div>
                <Btn variant="secondary" onClick={() => go("teacher-profile", { teacherId: instructor.id })}>
                  View profile
                </Btn>
              </div>
              <p className="mb-3 text-sm text-muted">
                Travel radius:{" "}
                {instructor.maxTravelDistance ? `${instructor.maxTravelDistance} miles` : "Not specified"}
              </p>
              <MatchScorePanel match={match} />
            </article>
          ))}
          {matches.data?.instructors.length === 0 ? (
            <p className="card card-pad">No matching instructors are available for this role.</p>
          ) : null}
        </div>
      )}
      {(matches.data?.pagination.totalPages ?? 0) > 1 ? (
        <div className="mt-5 flex justify-between">
          <Btn disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </Btn>
          <span>Page {page}</span>
          <Btn disabled={!matches.data?.pagination.hasNextPage} onClick={() => setPage(page + 1)}>
            Next
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

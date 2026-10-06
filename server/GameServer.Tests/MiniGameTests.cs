using System.Text.Json;
using GameServer.MiniGames;
using GameServer.Models;
using GameServer.Services;

namespace GameServer.Tests;

public class MiniGameTests
{
    private static readonly HashSet<string> Words = ["crane", "eerie", "slate", "trace", "crate", "react", "caner"];

    [Fact]
    public void Wordle_marks_duplicate_letters_correctly()
    {
        var marks = WordleEngine.Evaluate("eerie", "crane");
        Assert.Equal([LetterMark.Absent, LetterMark.Absent, LetterMark.Present, LetterMark.Absent, LetterMark.Correct], marks);
    }

    [Fact]
    public void Wordle_rejects_words_not_in_list_without_using_a_guess()
    {
        var round = new WordleRound("w", "crane", Words, 60_000);
        round.Begin(0);

        Assert.False(round.SubmitGuess("a", "zzzzz", 100).Accepted);
        Assert.False(round.SubmitGuess("a", "abc", 100).Accepted);
        Assert.True(round.SubmitGuess("a", "slate", 100).Accepted);

        var json = JsonSerializer.Serialize(round.GetPrivateState("a"));
        Assert.Contains("SLATE", json);
        Assert.DoesNotContain("zzzzz", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Wordle_public_state_never_contains_the_answer_or_letters()
    {
        var round = new WordleRound("w", "crane", Words, 60_000);
        round.Begin(0);
        round.SubmitGuess("a", "trace", 10);
        round.SubmitGuess("a", "crane", 20);

        var json = JsonSerializer.Serialize(round.GetPublicState(30));
        Assert.DoesNotContain("crane", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("trace", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Wordle_ranks_by_solved_then_guesses_then_time()
    {
        var round = new WordleRound("w", "crane", Words, 60_000);
        round.Begin(0);
        // Alice: 3 guesses, 22.3s. Bob: 3 guesses, 31.1s. Mike: 4 guesses, 18s. Sarah fails.
        foreach (var w in new[] { "slate", "trace" }) round.SubmitGuess("alice", w, 5_000);
        round.SubmitGuess("alice", "crane", 22_300);
        foreach (var w in new[] { "slate", "trace" }) round.SubmitGuess("bob", w, 5_000);
        round.SubmitGuess("bob", "crane", 31_100);
        foreach (var w in new[] { "slate", "trace", "crate" }) round.SubmitGuess("mike", w, 5_000);
        round.SubmitGuess("mike", "crane", 18_000);
        foreach (var w in new[] { "slate", "trace", "crate", "react", "caner", "eerie" }) round.SubmitGuess("sarah", w, 9_000);

        var ranked = RankingService.Rank(round.Score(["sarah", "mike", "bob", "alice"]));

        Assert.Equal(["alice", "bob", "mike", "sarah"], ranked.Select(r => r.PlayerId));
        Assert.False(ranked[3].Eligible);
        Assert.True(round.IsPlayerDone("sarah"));
    }

    private static HigherLowerQuestion Q(string id, double a, double b, string pick = "higher") =>
        new(id, "test", "Which is bigger?", new HigherLowerOption("A" + id, a), new HigherLowerOption("B" + id, b), "units", pick);

    [Fact]
    public void Higher_lower_hides_values_until_reveal()
    {
        var round = new HigherLowerRound("hl", [Q("1", 123_456, 654_321)]);
        round.Begin(0);

        Assert.DoesNotContain("123456", JsonSerializer.Serialize(round.GetPublicState(10)));

        round.Submit("a", 0, 1, 1_000);
        Assert.True(round.Tick(1_100, ["a"])); // everyone answered -> reveal early
        Assert.Contains("123456", JsonSerializer.Serialize(round.GetPublicState(1_200)));
    }

    [Fact]
    public void Higher_lower_ranks_by_correct_count_then_total_time()
    {
        var round = new HigherLowerRound("hl", [Q("1", 10, 5), Q("2", 1990, 2000, "lower")]);
        round.Begin(0);
        var active = new[] { "fast", "slow", "wrong" };

        // Q1 correct = A (0)
        round.Submit("fast", 0, 0, 1_000);
        round.Submit("slow", 0, 0, 4_000);
        round.Submit("wrong", 0, 1, 500);
        round.Tick(4_100, active);
        round.Tick(4_100 + HigherLowerRound.RevealMs, active); // next question starts
        var q2Start = 4_100 + HigherLowerRound.RevealMs;

        // Q2 correct = A (lower year)
        round.Submit("fast", 1, 0, q2Start + 1_000);
        round.Submit("slow", 1, 0, q2Start + 2_000);
        round.Submit("wrong", 1, 1, q2Start + 100);
        round.Tick(q2Start + 2_100, active);
        round.Tick(q2Start + 2_100 + HigherLowerRound.RevealMs, active);

        Assert.True(round.IsComplete(q2Start + 3_000 + HigherLowerRound.RevealMs, active));
        var ranked = RankingService.Rank(round.Score(active));
        Assert.Equal(["fast", "slow", "wrong"], ranked.Select(r => r.PlayerId));
        Assert.Equal((2, 2_000L), round.Tally("fast"));
        Assert.False(ranked[2].Eligible);
    }

    [Fact]
    public void Higher_lower_rejects_late_or_duplicate_answers()
    {
        var round = new HigherLowerRound("hl", [Q("1", 1, 2), Q("2", 3, 4)]);
        round.Begin(0);
        Assert.True(round.Submit("a", 0, 1, 100).Accepted);
        Assert.False(round.Submit("a", 0, 0, 200).Accepted);
        Assert.False(round.Submit("a", 1, 0, 200).Accepted);
        Assert.False(round.Submit("b", 0, 0, HigherLowerRound.QuestionMs + 1).Accepted);
    }

    private static LogicPuzzle Logic() =>
        new("l", "sequence", "2, 4, 8, 16, ?", null, null, ["18", "24", "30", "32"], 3, "doubles");

    [Fact]
    public void Logic_answer_validation()
    {
        Assert.True(LogicEngine.IsCorrect(Logic(), 3));
        Assert.False(LogicEngine.IsCorrect(Logic(), 0));
    }

    [Fact]
    public void Logic_allows_one_attempt_and_hides_correctness()
    {
        var round = new LogicRound(Logic(), 20_000);
        round.Begin(0);

        var first = round.Submit("a", 0, 1_000);
        Assert.True(first.Accepted);
        Assert.Null(first.Correct);
        Assert.False(round.Submit("a", 3, 2_000).Accepted);
        round.Submit("b", 3, 3_000);
        Assert.DoesNotContain("correct", JsonSerializer.Serialize(round.GetPublicState(3_000)), StringComparison.OrdinalIgnoreCase);

        var ranked = RankingService.Rank(round.Score(["a", "b"]));
        Assert.Equal("b", ranked[0].PlayerId);
        Assert.True(ranked[0].Eligible);
        Assert.False(ranked[1].Eligible);
    }

    [Fact]
    public void Logic_shuffle_keeps_the_correct_answer()
    {
        var service = new MiniGameService(TestContent.Load(), new SecureRandomSource());
        for (var i = 0; i < 20; i++)
        {
            var shuffled = service.ShuffleChoices(Logic());
            Assert.Equal("32", shuffled.Choices[shuffled.CorrectChoice]);
        }
    }

    [Fact]
    public void Chain_accepts_any_valid_answer_and_locks_after_wrong_guess()
    {
        var round = new ChainRound(new ChainPuzzle("c", "HEAD", "UP", ["LINE", "SET"], "medium"));
        round.Begin(0);

        var wrong = round.Submit("a", "cap", 100);
        Assert.False(wrong.Correct);
        Assert.False(round.Submit("a", "line", 500).Accepted); // still locked
        Assert.True(round.Submit("a", " Line ", 100 + ChainRound.WrongAnswerLockMs).Correct);
        Assert.True(round.Submit("b", "set", 200).Correct);
    }

    [Fact]
    public void Name_x_normalizes_answers()
    {
        var round = new NameXRound(new NameXPrompt("n", "animal", "C", "Name an animal beginning with C", ["cat", "capybara", "cheetah"]), 15_000);
        round.Begin(0);

        Assert.True(round.Submit("a", "  CAPYBARAS ", 100).Correct);
        Assert.True(round.Submit("b", "Chéetah", 100).Correct);
        Assert.False(round.Submit("c", "dog", 100).Correct);
    }

    [Fact]
    public void Pixel_puzzle_is_pixelated_and_never_leaks_answer()
    {
        var puzzle = new PixelPuzzle("p", "food", ["apple"], new() { ["r"] = "#ff0000" },
            Enumerable.Range(0, 16).Select(_ => "rrrrrrrr........").ToList(), "#ffffff");
        var round = new PixelGuessRound(puzzle, 14_000);
        round.Begin(0);

        var early = JsonSerializer.Serialize(round.GetPublicState(0));
        Assert.DoesNotContain("apple", early);
        Assert.Equal(4, round.Pixelate(2).Length);
        Assert.Equal("#ff0000", round.Pixelate(2)[0]);
        Assert.Equal("#ffffff", round.Pixelate(2)[1]);

        var wrong = round.Submit("a", "cherry", 1_000);
        Assert.NotNull(wrong.LockedUntil);
        Assert.False(round.Submit("a", "apple", 2_000).Accepted); // locked for 2s
        Assert.True(round.Submit("a", "apple", 3_100).Correct);
    }

    [Fact]
    public void All_shipped_content_loads()
    {
        var content = TestContent.Load();
        Assert.NotEmpty(content.WordleAnswers);
        Assert.True(content.WordleAllowed.Count > 1000);
        Assert.True(content.ChainPuzzles.Count >= 30);
        Assert.True(content.HigherLower.Count >= 20);
        Assert.True(content.NameX.Count >= 20);
        Assert.True(content.PixelPuzzles.Count >= 10);
        Assert.True(content.LogicPuzzles.Count >= 20);
        Assert.All(content.WordleAnswers, w => Assert.Contains(w, content.WordleAllowed));
    }
}
